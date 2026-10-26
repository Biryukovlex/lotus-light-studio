"""
Setup script for Lotus Lamp Python library
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read README for long description
readme_file = Path(__file__).parent / "README.md"
long_description = ""
if readme_file.exists():
    long_description = readme_file.read_text(encoding='utf-8')

setup(
    name="lotus_lamp",
    version="1.1.0",
    author="Wayne Porter",
    author_email="wporter82@gmail.com",
    description="Python library for controlling Lotus Lamp RGB LED strips via Bluetooth",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/Biryukovlex/lotus-light-studio",
    packages=find_packages(),
    package_data={
        'lotus_lamp': ['data/*.json', 'web/*'],
    },
    include_package_data=True,
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "Topic :: Home Automation",
        "Topic :: System :: Hardware",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.7",
    install_requires=[
        "bleak>=0.21.0",
    ],
    extras_require={
        'app': ["aiohttp>=3.9,<4; python_version >= '3.9'"],
        'dev': [
            'pytest>=7.0',
            'pytest-asyncio>=0.21',
            'pytest-cov>=4.0',
        ],
    },
    entry_points={
        'console_scripts': [
            'lotus-lamp-studio=lotus_lamp.app:main',
            'lotus-lamp-browser=examples.browser:main',
        ],
    },
    keywords="bluetooth ble led rgb lamp lotus smart-home",
    project_urls={
        "Bug Reports": "https://github.com/Biryukovlex/lotus-light-studio/issues",
        "Source": "https://github.com/Biryukovlex/lotus-light-studio",
        "Documentation": "https://github.com/Biryukovlex/lotus-light-studio/blob/main/docs/PROTOCOL.md",
    },
)
