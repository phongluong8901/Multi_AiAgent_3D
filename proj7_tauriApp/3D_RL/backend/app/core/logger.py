import logging
import sys

# ==============================================================================
# HE THONG LOGGING KY THUAT TAP TRUNG (TECHNICAL LOGGING)
# ==============================================================================
# Quy dinh chat che: Khong su dung emoji trong log. Su dung tien to ngoac vuong:
# [INFO], [SUCCESS], [WARN], [ERROR], [CONFIG], [TELEMETRY], [INFERENCE]

LOG_FORMAT = "%(asctime)s | [%(levelname)s] | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

logging.basicConfig(
    level=logging.INFO,
    format=LOG_FORMAT,
    datefmt=DATE_FORMAT,
    handlers=[logging.StreamHandler(sys.stdout)],
)


def get_logger(name: str) -> logging.Logger:
    """
    Lay the hien logger theo ten module de ghi log dong nhat trong backend.

    Args:
        name (str): Ten module (thuong dung __name__).

    Returns:
        logging.Logger: The hien logger da cau hinh san format.
    """
    return logging.getLogger(name)

