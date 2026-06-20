import os
import sys


def add_vendor_path():
    root_dir = os.path.dirname(os.path.dirname(__file__))
    vendor_dir = os.path.join(root_dir, "vendor")
    if os.path.isdir(vendor_dir) and vendor_dir not in sys.path:
        sys.path.insert(0, vendor_dir)
