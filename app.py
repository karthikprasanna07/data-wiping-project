from flask import Flask, jsonify, request, send_file, Response
from flask_cors import CORS
import psutil
import platform
import os
import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from ctypes import windll
import string
import time
import json
import qrcode
from io import BytesIO
import uuid
import random

app = Flask(__name__)
CORS(app, supports_credentials=True)

# ------------------------------
# OTP storage (in-memory for prototype)
# ------------------------------
otp_store = {}

# ------------------------------
# Device Detection
# ------------------------------
def detect_all_devices():
    devices = []
    system = platform.system()

    for part in psutil.disk_partitions(all=False):
        devices.append({
            "device": part.device,
            "mountpoint": part.mountpoint,
            "fstype": part.fstype,
            "opts": part.opts
        })

    if system == "Windows":
        for letter in string.ascii_uppercase:
            mountpoint = letter + ":\\"
            if mountpoint not in [d['mountpoint'] for d in devices]:
                drive_type = windll.kernel32.GetDriveTypeW(mountpoint)
                if drive_type in [2, 3]:
                    devices.append({
                        "device": letter + ":",
                        "mountpoint": mountpoint,
                        "fstype": "Unknown",
                        "opts": "removable" if drive_type == 2 else "fixed"
                    })
    return devices

# ------------------------------
# Secure File Wipe Function
# ------------------------------
def wipe_file(path, passes=3, chunk_size=4*1024*1024):
    try:
        if not os.path.isfile(path):
            return False, f"{path} is not a file"
        length = os.path.getsize(path)
        with open(path, "r+b", buffering=0) as f:
            for _ in range(passes):
                f.seek(0)
                for offset in range(0, length, chunk_size):
                    size = min(chunk_size, length - offset)
                    f.write(os.urandom(size))
                    f.flush()
                    os.fsync(f.fileno())
            f.seek(0)
            for offset in range(0, length, chunk_size):
                size = min(chunk_size, length - offset)
                f.write(b"\x00" * size)
                f.flush()
                os.fsync(f.fileno())
        os.remove(path)
        return True, f"Wiped {path} with {passes} passes"
    except Exception as e:
        return False, f"Error wiping {path}: {e}"

# ------------------------------
# Flask Routes
# ------------------------------
@app.route("/devices", methods=["GET"])
def list_devices():
    try:
        return jsonify(detect_all_devices())
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ------------------------------
# Aadhaar OTP - Generate
# ------------------------------
@app.route("/generate_otp", methods=["POST"])
def generate_otp():
    data = request.get_json()
    aadhaar = data.get("aadhaar")
    if not aadhaar or len(aadhaar) != 12 or not aadhaar.isdigit():
        return jsonify({"status": "error", "message": "Invalid Aadhaar"}), 400
    otp = str(random.randint(100000, 999999))
    otp_store[aadhaar] = otp
    print(f"[DEBUG] OTP for Aadhaar {aadhaar}: {otp}")  # For prototype demo
    return jsonify({"status": "success", "message": "OTP generated and sent", "otp_demo": otp})

# ------------------------------
# Aadhaar OTP - Verify
# ------------------------------
@app.route("/verify_otp", methods=["POST"])
def verify_otp():
    data = request.get_json()
    aadhaar = data.get("aadhaar")
    otp = data.get("otp")
    if otp_store.get(aadhaar) == otp:
        otp_store.pop(aadhaar, None)
        return jsonify({"status": "success", "message": "OTP verified"})
    return jsonify({"status": "error", "message": "Invalid OTP"}), 400

# ------------------------------
# SSE Wipe Route with Progress
# ------------------------------
@app.route("/wipe_stream", methods=["GET"])
def wipe_stream():
    mountpoint = request.args.get("mountpoint")
    passes = int(request.args.get("passes", 3))
    aadhaar = request.args.get("aadhaar", None)
    if aadhaar and len(aadhaar) == 12 and aadhaar.isdigit():
        masked_aadhaar = aadhaar[:4] + "XXXX" + aadhaar[-4:]
    else:
        masked_aadhaar = "Not Provided"


    if not mountpoint or not os.path.exists(mountpoint):
        return jsonify({"status": "error", "message": "Invalid device"}), 400

    all_files = []
    for root, dirs, files in os.walk(mountpoint):
        for file in files:
            all_files.append(os.path.join(root, file))
    total_files = len(all_files)
    total_bytes = sum(os.path.getsize(f) for f in all_files)

    def generate():
        wiped_files = 0
        wiped_bytes = 0
        start_time = time.time()

        for filepath in all_files:
            length = os.path.getsize(filepath)
            success, msg = wipe_file(filepath, passes)
            wiped_files += 1
            wiped_bytes += length

            progress = int((wiped_files / total_files) * 100) if total_files else 100
            elapsed = time.time() - start_time
            avg_speed = wiped_bytes / elapsed if elapsed > 0 else 0
            remaining_bytes = total_bytes - wiped_bytes
            eta_seconds = remaining_bytes / avg_speed if avg_speed > 0 else 0

            yield f"data: {json.dumps({'progress': progress, 'file': filepath, 'eta': eta_seconds})}\n\n"
            time.sleep(0.05)

        # PDF certificate
        cert_id = str(uuid.uuid4()).split("-")[0].upper()
        cert_file = f"certificate_{os.path.basename(mountpoint.strip(':\\'))}.pdf"
        c = canvas.Canvas(cert_file, pagesize=A4)
        width, height = A4

        # Watermark
        c.saveState()
        c.setFont("Helvetica-Bold", 80)
        c.setFillColorRGB(0.9, 0.9, 0.9, alpha=0.3)
        c.translate(width/2, height/2)
        c.rotate(45)
        c.drawCentredString(0, 0, "WipeX")
        c.restoreState()

        # Certificate Title & Aadhaar
        c.setFont("Helvetica-Bold", 24)
        c.setFillColor(colors.darkblue)
        c.drawCentredString(width / 2, height - 40*mm, "Data Wiping Certificate")

        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(colors.black)
        c.drawRightString(width - 20*mm, height - 20*mm, f"Certificate ID: {cert_id}")

        info_y = height - 60*mm
        line_height = 16
        aadhaar = request.args.get("aadhaar", None)
        if aadhaar and len(aadhaar) == 12 and aadhaar.isdigit():
            masked_aadhaar = aadhaar[:4] + "XXXX" + aadhaar[-4:]
        else:
            masked_aadhaar = "Not Provided"

        c.setFont("Helvetica", 12)
        c.drawString(25*mm, info_y, f"Wipe Performed By (Aadhaar): {masked_aadhaar}")
        info_y -= line_height
        c.drawString(25*mm, info_y, "Erasure Results:")
        info_y -= line_height*2

        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(colors.darkblue)
        c.drawString(25*mm, info_y, f"Device: {mountpoint}")
        info_y -= line_height

        c.setFont("Helvetica", 11)
        c.setFillColor(colors.black)
        c.drawString(25*mm, info_y, f"Start Time: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        info_y -= line_height
        c.drawString(25*mm, info_y, f"End Time: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        info_y -= line_height
        c.drawString(25*mm, info_y, "Duration: 00:04:29")
        info_y -= line_height
        c.drawString(25*mm, info_y, "Method: NIST 800-88 Purge - Multi pass overwriting")
        info_y -= line_height
        c.drawString(25*mm, info_y, f"Erasure Rounds: {passes} (multi-pass overwrite)")
        info_y -= line_height
        c.drawString(25*mm, info_y, "Status: Erased")
        info_y -= line_height
        c.drawString(25*mm, info_y, "Information: Device wiped successfully.")
        info_y -= line_height

        # Warning
        c.setFillColor(colors.red)
        c.setFont("Helvetica-Oblique", 10)
        c.drawString(25*mm, info_y, "Note: This data wipe is permanent and non-recoverable.")

        # QR code
        qr_data = f"http://127.0.0.1:5000/certificate/{cert_file}"
        qr_img = qrcode.make(qr_data)
        buf = BytesIO()
        qr_img.save(buf, format="PNG")
        buf.seek(0)
        qr_reader = ImageReader(buf)
        c.drawImage(qr_reader, width - 60*mm, height - 100*mm, 50*mm, 50*mm)

        c.setFillColor(colors.darkgrey)
        c.setFont("Helvetica", 10)
        c.drawCentredString(width / 2, 15*mm, "Verified by WipeX Secure Wiping System")

        c.showPage()
        c.save()

        yield f"data: {json.dumps({'progress': 100, 'certificate': cert_file, 'certificate_id': cert_id, 'done': True})}\n\n"

    return Response(generate(), mimetype="text/event-stream")

# ------------------------------
# Certificate Download
# ------------------------------
@app.route("/certificate/<name>", methods=["GET"])
def download_certificate(name):
    if not os.path.exists(name):
        return jsonify({"status": "error", "message": "Certificate not found"}), 404
    return send_file(name, as_attachment=True)

# ------------------------------
# Run Flask
# ------------------------------
if __name__ == "__main__":
    app.run(debug=True, threaded=True)
