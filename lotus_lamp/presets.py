"""Local, versioned timed presets. These are recipes, not captured LED frames."""

import json
from pathlib import Path
from uuid import uuid4

MAX_PAUSE_MS = 600_000
MAX_PRESETS = 100


def validate_recipe(data):
    name = data.get("name")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
        raise ValueError("Give the preset a name from 1 to 80 characters.")
    mode, pause_ms = data.get("mode"), data.get("pause_ms")
    if type(mode) is not int or not 0 <= mode <= 212:
        raise ValueError("Preset program must be an integer from 0 to 212.")
    if type(pause_ms) is not int or not 0 <= pause_ms <= MAX_PAUSE_MS:
        raise ValueError("Pause time must be from 0 to 600 seconds, in whole milliseconds.")
    speed = data.get("speed", 100)
    if type(speed) is not int or not 0 <= speed <= 100:
        raise ValueError("Preset speed must be an integer from 0 to 100.")
    return {"name": name.strip(), "mode": mode, "pause_ms": pause_ms, "speed": speed}


class PresetStore:
    def __init__(self, path):
        self.path = Path(path)
        self.items = []
        self.error = None
        try:
            if self.path.exists():
                document = json.loads(self.path.read_text())
                if document.get("version") != 1 or not isinstance(document.get("presets"), list):
                    raise ValueError("Unsupported preset file format")
                items = document["presets"]
                if len(items) > MAX_PRESETS:
                    raise ValueError("Too many presets")
                identifiers = set()
                for item in items:
                    recipe = validate_recipe(item)
                    identifier = item.get("id")
                    if not isinstance(identifier, str) or not identifier or len(identifier) > 64 or identifier in identifiers:
                        raise ValueError("Invalid preset identifier")
                    identifiers.add(identifier)
                    self.items.append({"id": identifier, **recipe})
        except (OSError, ValueError, TypeError, AttributeError) as exc:
            self.items = []
            self.error = f"Could not load presets: {exc}. The original file has been preserved."

    def get(self, identifier):
        return next((item for item in self.items if item["id"] == identifier), None)

    def _commit(self, items):
        if self.error:
            raise ValueError(self.error)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".tmp")
        try:
            temporary.write_text(json.dumps({"version": 1, "presets": items}, indent=2) + "\n")
            temporary.chmod(0o600)
            temporary.replace(self.path)
        finally:
            temporary.unlink(missing_ok=True)
        self.items = items

    def save(self, data):
        recipe = validate_recipe(data)
        identifier = data.get("id")
        if identifier is not None and not self.get(identifier):
            raise ValueError("This preset no longer exists. Refresh and try again.")
        if identifier is None and len(self.items) >= MAX_PRESETS:
            raise ValueError("You can save up to 100 presets. Delete one to make room.")
        item = {"id": identifier or uuid4().hex, **recipe}
        items = [item if old["id"] == identifier else old for old in self.items]
        if identifier is None:
            items.append(item)
        self._commit(items)
        return item

    def delete(self, identifier):
        if not self.get(identifier):
            raise ValueError("This preset no longer exists. Refresh and try again.")
        self._commit([item for item in self.items if item["id"] != identifier])
