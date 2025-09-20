from flask import Flask, jsonify, request, send_file, Response
from flask_cors import CORS
import psutil
import platform
import os
import datetime
from reportlab.pdfgen import canvas
import string
from ctypes import windll
import time
import json

app = Flask(__name__)
# Allow CORS for React frontend
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
    """Overwrite and delete a single file."""
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
    return jsonify(detect_all_devices())

# ------------------------------
# SSE Wipe Route (Real-Time Progress)
# ------------------------------
@app.route("/wipe_stream", methods=["GET"])
def wipe_stream():
    mountpoint = request.args.get("mountpoint")
    passes = int(request.args.get("passes", 3))

    if not mountpoint or not os.path.exists(mountpoint):
        return jsonify({"status": "error", "message": "Invalid device"}), 400

    # Count all files
    all_files = []
    for root, dirs, files in os.walk(mountpoint):
        for file in files:
            all_files.append(os.path.join(root, file))
    total_files = len(all_files)

    # SSE generator
    def generate():
        wiped_files = 0
        results = []

        for filepath in all_files:
            success, msg = wipe_file(filepath, passes)
            results.append({"file": filepath, "status": success, "message": msg})
            wiped_files += 1
            progress = int((wiped_files / total_files) * 100) if total_files else 100

            # Stream progress
            yield f"data: {json.dumps({'progress': progress, 'file': filepath})}\n\n"
            time.sleep(0.05)  # small delay for smooth SSE

        # Generate PDF certificate at the end
        cert_file = f"certificate_{os.path.basename(mountpoint.strip(':\\'))}.pdf"
        c = canvas.Canvas(cert_file)
        c.drawString(100, 750, "Data Wiping Certificate")
        c.drawString(100, 720, f"Device: {mountpoint}")
        c.drawString(100, 700, f"Date: {datetime.datetime.now()}")
        c.drawString(100, 680, f"Passes: {passes}")
        c.drawString(100, 660, f"Files wiped: {len(results)}")
        c.drawString(100, 640, "Wipe method: Multi-pass overwrite + delete")
        c.save()

        # Final event
        yield f"data: {json.dumps({'progress': 100, 'certificate': cert_file, 'done': True})}\n\n"

    return Response(generate(), mimetype="text/event-stream")

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
