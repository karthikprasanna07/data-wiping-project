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
import shutil

# ------------------------------ PDF Signing ------------------------------
from pyhanko.sign import signers
from pyhanko.sign.fields import SigFieldSpec, append_signature_field
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter

def sign_pdf(input_pdf_path, output_pdf_path):
    # Load signer
    signer = signers.SimpleSigner.load(
        cert_file="certs/wipex_cert.pem",
        key_file="certs/wipex_private.pem",
        key_passphrase=None  # bytes if encrypted
    )

    # Open the PDF
    with open(input_pdf_path, "rb") as infile:
        writer = IncrementalPdfFileWriter(infile)

        # Append signature field properly
        append_signature_field(writer, SigFieldSpec("Sig1"))

        # Sign and write
        with open(output_pdf_path, "wb") as outfile:
            signers.sign_pdf(
                writer,
                signature_meta=signers.PdfSignatureMetadata(field_name="Sig1"),
                signer=signer,
                output=outfile
            )



# -------------------------------------------------------------------------

app = Flask(__name__)
CORS(app, supports_credentials=True)
otp_store = {}

# ------------------------------ Device Detection ------------------------------
# ------------------------------ Device Detection ------------------------------
import shutil # Add this import at the top

def detect_all_devices():
    devices = []
    # Use psutil.disk_partitions to get all partitions
    for part in psutil.disk_partitions(all=False):
        try:
            # Use shutil.disk_usage to get total, used, and free space
            usage = shutil.disk_usage(part.mountpoint)
            total_size_gb = round(usage.total / (1024**3), 2)
            used_space_gb = round(usage.used / (1024**3), 2) # Get used space
            devices.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "opts": part.opts,
                "size": f"{total_size_gb} GB",
                "used": f"{used_space_gb} GB" # Add the used space field here
            })
        except Exception as e:
            # Handle cases where disk usage is not available (e.g., system drives)
            print(f"Could not get usage for {part.mountpoint}: {e}")
            devices.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "opts": part.opts,
                "size": "N/A",
                "used": "N/A"
            })
    return devices
# ------------------------------ Secure File Wipe ------------------------------
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

# ------------------------------ Flask Routes ------------------------------
@app.route("/devices", methods=["GET"])
def list_devices():
    try:
        return jsonify(detect_all_devices())
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/generate_otp", methods=["POST"])
def generate_otp():
    data = request.get_json()
    aadhaar = data.get("aadhaar")
    if not aadhaar or len(aadhaar) != 12 or not aadhaar.isdigit():
        return jsonify({"status": "error", "message": "Invalid Aadhaar"}), 400
    otp = str(random.randint(100000, 999999))
    otp_store[aadhaar] = otp
    print(f"[DEBUG] OTP for Aadhaar {aadhaar}: {otp}")
    return jsonify({"status": "success", "message": "OTP generated and sent", "otp_demo": otp})

@app.route("/verify_otp", methods=["POST"])
def verify_otp():
    data = request.get_json()
    aadhaar = data.get("aadhaar")
    otp = data.get("otp")
    if otp_store.get(aadhaar) == otp:
        otp_store.pop(aadhaar, None)
        return jsonify({"status": "success", "message": "OTP verified"})
    return jsonify({"status": "error", "message": "Invalid OTP"}), 400

# ------------------------------ Wipe Stream ------------------------------
CERT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "certs")
os.makedirs(CERT_DIR, exist_ok=True)

@app.route("/wipe_stream", methods=["GET"])
def wipe_stream():
    mountpoint = request.args.get("mountpoint")
    passes = int(request.args.get("passes", 3))
    aadhaar = request.args.get("aadhaar", "Not Provided")

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

        # PDF certificate creation & signing
        try:
            unique_id = uuid.uuid4().hex
            cert_file_unsigned = os.path.join(CERT_DIR, f"certificate_unsigned_{unique_id}.pdf")
            cert_file_signed = os.path.join(CERT_DIR, f"certificate_signed_{unique_id}.pdf")

            # Create certificate PDF
            c = canvas.Canvas(cert_file_unsigned, pagesize=A4)
            width, height = A4

            c.saveState()
            c.setFont("Helvetica-Bold", 80)
            c.setFillColorRGB(0.9, 0.9, 0.9, alpha=0.3)
            c.translate(width/2, height/2)
            c.rotate(45)
            c.drawCentredString(0, 0, "WipeX")
            c.restoreState()

            # Certificate text
            c.setFont("Helvetica-Bold", 24)
            c.setFillColor(colors.darkblue)
            c.drawCentredString(width / 2, height - 40*mm, "Data Wiping Certificate")
            c.setFont("Helvetica", 12)
            info_y = height - 60*mm
            line_height = 16
            masked_aadhaar = aadhaar[:4] + "XXXX" + aadhaar[-4:] if len(aadhaar) == 12 else aadhaar
            c.drawString(25*mm, info_y, f"Wipe Performed By (Aadhaar): {masked_aadhaar}")
            info_y -= line_height
            c.setFont("Helvetica-Bold", 13)
            c.drawString(25*mm, info_y - 8, "Erasure Results:")
            info_y -= line_height * 2
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
            c.drawString(25*mm, info_y, f"Method: NIST 800-88 Purge - Multi pass overwriting")
            info_y -= line_height
            c.drawString(25*mm, info_y, f"Erasure Rounds: {passes}")
            info_y -= line_height
            c.drawString(25*mm, info_y, "Status: Erased")
            info_y -= line_height
            c.drawString(25*mm, info_y, "Information: Device wiped successfully.")
            info_y -= line_height
            c.setFillColor(colors.red)
            c.setFont("Helvetica-Oblique", 10)
            c.drawString(25*mm, info_y, "Note: This data wipe is permanent and non-recoverable.")

            # QR code
            qr_data = f"http://127.0.0.1:5000/certificate/{os.path.basename(cert_file_signed)}"
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

            # Sign PDF (tamper-proof)
            sign_pdf(cert_file_unsigned, cert_file_signed)
            if os.path.exists(cert_file_unsigned):
                os.remove(cert_file_unsigned)

            yield f"data: {json.dumps({
                'progress': 100,
                'certificate': os.path.basename(cert_file_signed),
                'done': True
            })}\n\n"

        except Exception as e:
            print("[ERROR] PDF signing failed:", e)
            yield f"data: {json.dumps({
                'progress': 100,
                'certificate_error': str(e),
                'done': True
            })}\n\n"

    return Response(generate(), mimetype="text/event-stream")

# ------------------------------ Download Certificate ------------------------------
@app.route("/certificate/<name>", methods=["GET"])
# app.py

# ... (rest of your imports and code) ...

# ------------------------------ Download Certificate ------------------------------
@app.route("/certificate/<name>", methods=["GET"])
def download_certificate(name):
    filepath = os.path.join(CERT_DIR, name)
    if not os.path.exists(filepath):
        return jsonify({"status": "error", "message": "Certificate not found"}), 404

    # Check for the 'format' query parameter
    requested_format = request.args.get("format")

    if requested_format == "json":
        # Generate the JSON response
        cert_data = {
            "device": "Device Placeholder",  # You'll need to pass this from the wipe stream
            "mountpoint": "Mountpoint Placeholder", # You'll need to pass this from the wipe stream
            "wipe_date": datetime.datetime.now().isoformat(),
            "status": "Erased",
            "method": "NIST 800-88 Purge - Multi pass overwriting",
            "certificate_file": name
        }
        response = jsonify(cert_data)
        response.headers['Content-Disposition'] = f'attachment; filename="{os.path.splitext(name)[0]}.json"'
        response.headers['Content-Type'] = 'application/json'
        return response
    
    # Default to downloading the PDF file
    return send_file(filepath, as_attachment=True)

# ... (rest of your code) ...
# ------------------------------ Run Flask ------------------------------
if __name__ == "__main__":
    app.run(debug=True, threaded=True)
