"""
Lotus Lamp Python Library
==========================

A Python library for controlling Lotus Lamp RGB LED strips via Bluetooth Low Energy (BLE).

Supports Lotus Lamp devices using the Lotus Lamp X app protocol.

Local App:
    Run python -m lotus_lamp.app (Python 3.11+) and scan/connect in the UI.
    The browser app stores its device and custom presets separately from this library.

Library Setup:
    Pass DeviceConfig directly, or use the optional setup wizard:

    $ python -m lotus_lamp.setup

    The wizard scans, suggests connection details and saves a library configuration.
    Discovered UUIDs do not by themselves establish controller compatibility.

Basic Usage:
    >>> from lotus_lamp import LotusLamp
    >>> import asyncio
    >>>
    >>> async def main():
    ...     lamp = LotusLamp()  # Loads saved configuration
    ...     await lamp.connect()
    ...     await lamp.set_rgb(255, 0, 0)  # Red
    ...     await lamp.set_animation(143)  # W-R-W Flow
    ...     await lamp.disconnect()
    >>>
    >>> asyncio.run(main())

Features:
    - BLE discovery and GATT inspection for compatible controllers
    - RGB color control (16.7 million colors)
    - 213 built-in animation modes
    - Brightness control (0-100%)
    - Speed control (0-100%)
    - Mode search and lookup by name
    - Category-based mode organization
    - Multi-device support

Author: Wayne Porter
License: MIT
"""

__version__ = "1.1.0"
__author__ = "Wayne Porter"
__license__ = "MIT"

# Import main classes for easy access
from .controller import LotusLamp
from .modes import (
    get_mode_name,
    get_mode_category,
    search_modes,
    get_mode_by_category_index,
    CATEGORIES,
    list_all_categories,
    list_category_modes
)
from .config import DeviceConfig, ConfigManager, create_default_config
from .scanner import LotusLampScanner, DeviceInfo
from .advanced_scanner import AdvancedDeviceScanner

# Define what gets imported with "from lotus_lamp import *"
__all__ = [
    'LotusLamp',
    'get_mode_name',
    'get_mode_category',
    'search_modes',
    'get_mode_by_category_index',
    'CATEGORIES',
    'list_all_categories',
    'list_category_modes',
    'DeviceConfig',
    'ConfigManager',
    'create_default_config',
    'LotusLampScanner',
    'DeviceInfo',
    'AdvancedDeviceScanner',
]
