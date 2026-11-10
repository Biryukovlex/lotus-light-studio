"""Preset persistence without Bluetooth or user files."""

import json
import os
from pathlib import Path
from unittest.mock import patch

import pytest

from lotus_lamp.presets import PresetStore


def test_roundtrip_update_delete_and_private_permissions(tmp_path):
    path = tmp_path / "presets.json"
    store = PresetStore(path)
    first = store.save({"name": " Midnight ", "mode": 0, "pause_ms": 0})
    assert first["name"] == "Midnight"
    if os.name != "nt":  # POSIX permission bits do not apply on Windows
        assert path.stat().st_mode & 0o777 == 0o600
    restored = PresetStore(path)
    assert restored.items == [first]
    updated = restored.save({**first, "pause_ms": 258, "name": "Afterglow"})
    assert PresetStore(path).items == [updated]
    restored.delete(first["id"])
    assert PresetStore(path).items == []


@pytest.mark.parametrize("change", [{"name": " "}, {"name": "x" * 81}, {"mode": True},
    {"mode": 213}, {"pause_ms": -1}, {"pause_ms": True}, {"pause_ms": 600001}, {"pause_ms": 2.5},
    {"speed": True}, {"speed": -1}, {"speed": 101}, {"speed": 12.5}])
def test_invalid_recipe_does_not_write(tmp_path, change):
    store = PresetStore(tmp_path / "presets.json")
    with pytest.raises(ValueError):
        store.save({"name": "Frame", "mode": 138, "pause_ms": 258, **change})
    assert not store.path.exists()


def test_corrupt_file_is_preserved_and_cannot_be_overwritten(tmp_path):
    path = tmp_path / "presets.json"
    path.write_text('{"version":99,"presets":[]}')
    original = path.read_bytes()
    store = PresetStore(path)
    assert store.error and store.items == []
    with pytest.raises(ValueError, match="preserved"):
        store.save({"name": "Frame", "mode": 138, "pause_ms": 258})
    assert path.read_bytes() == original


def test_failed_replace_preserves_previous_file_and_memory(tmp_path):
    store = PresetStore(tmp_path / "presets.json")
    item = store.save({"name": "First", "mode": 138, "pause_ms": 258})
    original = store.path.read_bytes()
    with patch.object(Path, "replace", side_effect=OSError("Disk unavailable")):
        with pytest.raises(OSError):
            store.save({**item, "name": "Second"})
    assert store.items == [item]
    assert store.path.read_bytes() == original
    assert not store.path.with_suffix(".tmp").exists()


def test_unknown_edit_delete_and_capacity_are_explicit(tmp_path):
    store = PresetStore(tmp_path / "presets.json")
    with pytest.raises(ValueError, match="no longer exists"):
        store.save({"id": "missing", "name": "Frame", "mode": 138, "pause_ms": 258})
    with pytest.raises(ValueError, match="no longer exists"):
        store.delete("missing")
    store.items = [{"id": str(index), "name": "Frame", "mode": 138, "pause_ms": 258} for index in range(100)]
    with pytest.raises(ValueError, match="100 presets"):
        store.save({"name": "Overflow", "mode": 0, "pause_ms": 0})


def test_legacy_presets_default_to_100_without_overwriting_the_file(tmp_path):
    path = tmp_path / "presets.json"
    path.write_text(json.dumps({"version": 1, "presets": [
        {"id": "legacy", "name": "Old frame", "mode": 138, "pause_ms": 258}]}))
    original = path.read_bytes()
    store = PresetStore(path)
    assert store.items[0]["speed"] == 100
    assert path.read_bytes() == original
    item = store.save({**store.items[0], "speed": 0})
    assert PresetStore(path).items == [item]
    assert item["speed"] == 0
