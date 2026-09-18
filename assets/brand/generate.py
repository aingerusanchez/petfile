"""
The icon candidates, drawn rather than approximated.

Run with `python3 assets/brand/generate.py`; it rewrites every SVG beside it.
**The point of this file is that a measurement is one edit.** Seven rounds of
image generation could not put the strap inside the launcher's safe circle or
lay the letter on the tag's plane — a generator approximates, and this stage is
about precision. Nothing here is decided yet: the candidates sit side by side
until one is chosen.

**Geometry on Android's own adaptive grid.** The canvas is 108dp. The launcher
masks away everything outside a 72dp circle and only *guarantees* the central
66dp, so anything that has to survive lives inside a circle of radius 33 at
(54, 54). The strap is the deliberate exception: it is a fragment, meant to run
off the edges, so cropping it further still reads as a strap. That property is
the one thing no other composition in this exploration had.

**Two flat tones make the strap's thickness**, never a gradient or a shadow:
the underside takes one step down the accent's own tonal ramp. DESIGN.md's rule
is that depth here is tonal.
"""

import pathlib

OUT = pathlib.Path(__file__).parent

C = dict(
    ground="#0B1120",  # Polar Night
    strap="#7DD3E8",  # Aqua Glaciar
    strapUnder="#1B7F98",  # a step down its own ramp: thickness, not shadow
    tag="#1E293B",  # Elevated Frost
    rim="#334155",  # Steel Frost — the metal edge
    ring="#F1F5F9",  # Snow White
    paw="#CBD5E1",  # Frost Grey — the silver engraving
)

# The themed-icon layer: one colour, everything else knocked out. A shape that
# only exists as a colour disappears here, which is why the paw is a hole.
MONO = dict(
    ground="none",
    strap="#F1F5F9",
    strapUnder="#F1F5F9",
    tag="#F1F5F9",
    rim="#F1F5F9",
    ring="#F1F5F9",
    paw="none",
)


def paw(cx, cy, s=1.0, fill="#CBD5E1", skew=0.0):
    """Four toes and a heel. Nothing else survives 48px, and nothing else is needed."""
    parts = [
        (cx, cy + 5.0 * s, 6.3 * s, 4.7 * s, 0),
        (cx - 8.5 * s, cy - 1.5 * s, 2.7 * s, 3.6 * s, -22),
        (cx - 4.0 * s, cy - 5.0 * s, 2.8 * s, 3.8 * s, -8),
        (cx + 4.0 * s, cy - 5.0 * s, 2.8 * s, 3.8 * s, 8),
        (cx + 8.5 * s, cy - 1.5 * s, 2.7 * s, 3.6 * s, 22),
    ]
    return "\n    ".join(
        f'<ellipse cx="{x:.2f}" cy="{y:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" '
        f'fill="{fill}" transform="rotate({rot + skew:.1f} {x:.2f} {y:.2f})"/>'
        for x, y, rx, ry, rot in parts
    )


def ring(cx, cy, outer, inner, fill):
    """An annulus as one path, so the middle stays a hole and not a stacked circle."""
    return (
        f'<path fill="{fill}" fill-rule="evenodd" d="'
        f"M{cx - outer:.2f} {cy:.2f}a{outer:.2f} {outer:.2f} 0 1 0 {outer * 2:.2f} 0"
        f"a{outer:.2f} {outer:.2f} 0 1 0 {-outer * 2:.2f} 0z"
        f"M{cx - inner:.2f} {cy:.2f}a{inner:.2f} {inner:.2f} 0 1 1 {inner * 2:.2f} 0"
        f'a{inner:.2f} {inner:.2f} 0 1 1 {-inner * 2:.2f} 0z"/>'
    )


def strap(c):
    """A band with its underside showing: thickness from two flat tones."""
    return (
        f'<path fill="{c["strapUnder"]}" d="M0 38Q54 44 108 38L108 43Q54 49 0 43Z"/>\n    '
        f'<path fill="{c["strap"]}" d="M0 24Q54 30 108 24L108 38Q54 44 0 38Z"/>'
    )


def wrap(body, c, bg=True):
    ground = (
        f'<rect width="108" height="108" fill="{c["ground"]}"/>\n    '
        if bg and c["ground"] != "none"
        else ""
    )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" '
        f'width="108" height="108">\n    {ground}{body}\n</svg>\n'
    )


def candidates(c):
    out = {}

    # 1 — the collar fragment: strap, D-ring, tag, silver paw. Everything
    #     between y=24 and y=87, which is the 66dp Android guarantees.
    out["collar-paw"] = (
        strap(c)
        + "\n    "
        + ring(54, 54, 6.6, 3.6, c["ring"])
        + "\n    "
        + f'<circle cx="54" cy="70" r="17.5" fill="{c["tag"]}" stroke="{c["rim"]}" stroke-width="1.7"/>'
        + "\n    "
        + paw(54, 70, 1.0, c["paw"])
    )

    # 2 — the tag alone, with the paw given the room the strap costs. Reads as
    #     a pendant rather than a collar, which is the trade.
    out["tag-paw"] = (
        ring(54, 30, 9.0, 5.0, c["ring"])
        + "\n    "
        + f'<circle cx="54" cy="63" r="24" fill="{c["tag"]}" stroke="{c["rim"]}" stroke-width="2.0"/>'
        + "\n    "
        + paw(54, 63, 1.38, c["paw"])
    )

    # 3 — the paw knocked out. **The tag has to be LIGHT for this to exist at
    #     all**: a hole in a dark tag on a dark ground is not a hole, it is
    #     nothing. The inversion is the condition of the idea, not a preference.
    knock = c["ground"] if c["ground"] != "none" else "#0B1120"
    face = c["ring"] if c["ring"] != "none" else "#F1F5F9"
    out["collar-paw-negative"] = (
        strap(c)
        + "\n    "
        + ring(54, 54, 6.6, 3.6, c["strap"])
        + "\n    "
        + f'<circle cx="54" cy="70" r="17.5" fill="{face}"/>'
        + "\n    "
        + paw(54, 70, 1.0, knock)
    )

    # 4 — the tag at an angle. Ring and tag rotate as ONE group, which is the
    #     only way they stay attached; posing them separately is what deformed
    #     every generated attempt.
    out["angled-tag-paw"] = (
        '<g transform="rotate(-20 54 56)">'
        + ring(54, 28, 8.6, 4.8, c["strap"] if c["strap"] != "none" else c["ring"])
        + f'<ellipse cx="54" cy="64" rx="22" ry="19.5" fill="{c["tag"]}" stroke="{c["rim"]}" stroke-width="1.9"/>'
        + f'{paw(54, 64, 1.22, c["paw"], skew=6)}</g>'
    )
    return out


if __name__ == "__main__":
    for name, body in candidates(C).items():
        (OUT / f"{name}.svg").write_text(wrap(body, C))
    for name, body in candidates(MONO).items():
        (OUT / f"{name}-mono.svg").write_text(wrap(body, MONO, bg=False))
    print("\n".join(sorted(p.name for p in OUT.glob("*.svg"))))
