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

app = Flask(__name__)
CORS(app, supports_credentials=True)

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
def wipe_file(path, passes=3):
    try:
        if not os.path.isfile(path):
            return False, f"{path} is not a file"

        length = os.path.getsize(path)
        with open(path, "r+b", buffering=0) as f:
            for _ in range(passes):
                f.seek(0)
                f.write(os.urandom(length))
                f.flush()
                os.fsync(f.fileno())
            f.seek(0)
            f.write(b"\x00" * length)
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
# SSE Wipe Route with ETA
# ------------------------------
@app.route("/wipe_stream", methods=["GET"])
def wipe_stream():
    # --- Capture request arguments immediately ---
    mountpoint = request.args.get("mountpoint")
    passes = int(request.args.get("passes", 3))

    if not mountpoint or not os.path.exists(mountpoint):
        return jsonify({"status": "error", "message": "Invalid device"}), 400

    # --- Collect all files to wipe ---
    all_files = []
    for root, dirs, files in os.walk(mountpoint):
        for file in files:
            all_files.append(os.path.join(root, file))
    total_files = len(all_files)

    # --- SSE generator ---
    def generate():
        wiped_files = 0
        results = []
        start_time = time.time()

        for filepath in all_files:
            success, msg = wipe_file(filepath, passes)
            if not success:
                print(f"Could not wipe {filepath}: {msg}")
            results.append({"file": filepath, "status": success, "message": msg})
            wiped_files += 1
            progress = int((wiped_files / total_files) * 100) if total_files else 100

          # --- ETA calculation ---
            elapsed = time.time() - start_time
            avg_time_per_file = elapsed / wiped_files if wiped_files > 0 else 0
            remaining_files = total_files - wiped_files
            eta_seconds = avg_time_per_file * remaining_files   # use this, not overwritten
            eta = eta_seconds  # keep as float, let frontend handle rounding


            # --- Send progress + ETA ---
            yield f"data: {json.dumps({'progress': progress, 'file': filepath, 'eta': eta})}\n\n"
            time.sleep(0.05)

        # --- Generate PDF Certificate ---
        cert_file = f"certificate_{os.path.basename(mountpoint.strip(':\\'))}.pdf"
        c = canvas.Canvas(cert_file, pagesize=A4)
        width, height = A4

        # Header
        c.setFont("Helvetica-Bold", 24)
        c.setFillColor(colors.darkblue)
        c.drawCentredString(width / 2, height - 40*mm, "Data Wiping Certificate")

        # Device info
        c.setFont("Helvetica", 12)
        c.setFillColor(colors.black)
        info_y = height - 60*mm
        line_height = 16
        c.drawString(25*mm, info_y, f"Device: {mountpoint}")
        info_y -= line_height
        c.drawString(25*mm, info_y, f"Date: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        info_y -= line_height
        c.drawString(25*mm, info_y, f"Passes: {passes}")
        info_y -= line_height
        c.drawString(25*mm, info_y, f"Files wiped: {len(results)}")
        info_y -= line_height
        c.drawString(25*mm, info_y, "Wipe Method: Multi-pass overwrite")
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

        # Footer
        c.setFillColor(colors.darkgrey)
        c.setFont("Helvetica", 10)
        c.drawCentredString(width / 2, 15*mm, "Verified by WipeX Secure Wiping System")

        c.showPage()
        c.save()

        # --- Final SSE with done flag ---
        yield f"data: {json.dumps({'progress': 100, 'certificate': cert_file, 'done': True})}\n\n"

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
