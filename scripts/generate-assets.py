#!/usr/bin/env python3
"""
TripCircle — Clean, Minimal, Aesthetic Brand Asset Generator
Generates:
- apps/mobile/assets/icon.svg (1024x1024)
- apps/mobile/assets/icon.png (1024x1024 full bleed)
- apps/mobile/assets/adaptive-icon.png (1024x1024 transparent foreground)
- apps/mobile/assets/splash.png (1242x2436 minimal vertical splash)
- apps/mobile/assets/favicon.png (48x48)
- apps/mobile/assets/logo.svg (800x240 horizontal vector brand lockup)
- apps/mobile/assets/logo.png (800x240)
"""

import os
import math
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = REPO_ROOT / "apps" / "mobile" / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

def polar_to_xy(cx, cy, r, angle_deg):
    rad = math.radians(angle_deg)
    return (cx + r * math.cos(rad), cy - r * math.sin(rad))

def make_arc_d(cx, cy, r, start_deg, end_deg):
    """Arc in SVG with clockwise visual sweep (sweep-flag=0 in math polar coordinates)"""
    x1, y1 = polar_to_xy(cx, cy, r, start_deg)
    x2, y2 = polar_to_xy(cx, cy, r, end_deg)
    span = (end_deg - start_deg) % 360
    large_arc = 1 if span > 180 else 0
    return f"M {x1:.2f} {y1:.2f} A {r} {r} 0 {large_arc} 0 {x2:.2f} {y2:.2f}"

def generate_icon_svg(transparent_bg=False):
    cx, cy = 512, 512
    r = 255
    stroke_w = 58

    # Three harmonic orbit arcs centered at 90° (top), 210° (bottom-left), 330° (bottom-right)
    # Each arc spans 96° with 24° clean clearance gaps
    d1 = make_arc_d(cx, cy, r, 42, 138)
    d2 = make_arc_d(cx, cy, r, 162, 258)
    d3 = make_arc_d(cx, cy, r, 282, 378)

    bg_elem = ""
    if not transparent_bg:
        bg_elem = """
  <!-- Background: Deep Midnight Obsidian -->
  <rect width="1024" height="1024" fill="url(#bgGrad)"/>
  <!-- Ambient Center Illumination -->
  <circle cx="512" cy="512" r="420" fill="url(#centerGlow)"/>
"""

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B0F19"/>
      <stop offset="60%" stop-color="#070A12"/>
      <stop offset="100%" stop-color="#020408"/>
    </linearGradient>

    <!-- Arc 1: Pure Electric Mint to Crisp Emerald Teal -->
    <linearGradient id="g1" x1="100%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#00F5A0"/>
      <stop offset="100%" stop-color="#00D2B4"/>
    </linearGradient>

    <!-- Arc 2: Emerald Teal to Electric Cyan -->
    <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00D2B4"/>
      <stop offset="100%" stop-color="#0EA5E9"/>
    </linearGradient>

    <!-- Arc 3: Electric Cyan to Pure Mint -->
    <linearGradient id="g3" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0EA5E9"/>
      <stop offset="100%" stop-color="#00F5A0"/>
    </linearGradient>

    <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00F5A0" stop-opacity="0.10"/>
      <stop offset="60%" stop-color="#0EA5E9" stop-opacity="0.02"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>

    <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="20" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  {bg_elem}

  <!-- Emblem: Three Harmonic Orbit Ribbons -->
  <g filter="url(#subtleGlow)">
    <path d="{d1}" fill="none" stroke="url(#g1)" stroke-width="{stroke_w}" stroke-linecap="round"/>
    <path d="{d2}" fill="none" stroke="url(#g2)" stroke-width="{stroke_w}" stroke-linecap="round"/>
    <path d="{d3}" fill="none" stroke="url(#g3)" stroke-width="{stroke_w}" stroke-linecap="round"/>
    <!-- Center Equilibrium Node -->
    <circle cx="{cx}" cy="{cy}" r="14" fill="#00F5A0"/>
  </g>
</svg>"""

def generate_logo_svg(transparent_bg=False):
    cx, cy = 116, 120
    r = 62
    stroke_w = 14

    d1 = make_arc_d(cx, cy, r, 42, 138)
    d2 = make_arc_d(cx, cy, r, 162, 258)
    d3 = make_arc_d(cx, cy, r, 282, 378)

    bg_elem = ""
    if not transparent_bg:
        bg_elem = '<rect width="800" height="240" fill="#0B0F19"/>'

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 240" width="800" height="240">
  <defs>
    <linearGradient id="logoG1" x1="100%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#00F5A0"/>
      <stop offset="100%" stop-color="#00D2B4"/>
    </linearGradient>
    <linearGradient id="logoG2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00D2B4"/>
      <stop offset="100%" stop-color="#0EA5E9"/>
    </linearGradient>
    <linearGradient id="logoG3" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0EA5E9"/>
      <stop offset="100%" stop-color="#00F5A0"/>
    </linearGradient>
  </defs>

  {bg_elem}

  <!-- Emblem -->
  <g>
    <path d="{d1}" fill="none" stroke="url(#logoG1)" stroke-width="{stroke_w}" stroke-linecap="round"/>
    <path d="{d2}" fill="none" stroke="url(#logoG2)" stroke-width="{stroke_w}" stroke-linecap="round"/>
    <path d="{d3}" fill="none" stroke="url(#logoG3)" stroke-width="{stroke_w}" stroke-linecap="round"/>
    <circle cx="{cx}" cy="{cy}" r="3.5" fill="#00F5A0"/>
  </g>

  <!-- Typography: Title Case "TripCircle" -->
  <text x="216" y="132" font-family="'Liberation Sans', 'Inter', -apple-system, sans-serif" font-size="64" font-weight="700" letter-spacing="-1.5px">
    <tspan fill="#FFFFFF">Trip</tspan><tspan fill="#00F5A0">Circle</tspan>
  </text>
  <text x="218" y="170" fill="#64748B" font-family="'Liberation Sans', 'Inter', -apple-system, sans-serif" font-size="12" font-weight="600" letter-spacing="4.5px">SHARED TRIP LEDGER</text>
</svg>"""

def generate_splash_svg():
    cx, cy = 621, 1020
    r = 160
    stroke_w = 38

    d1 = make_arc_d(cx, cy, r, 42, 138)
    d2 = make_arc_d(cx, cy, r, 162, 258)
    d3 = make_arc_d(cx, cy, r, 282, 378)

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1242 2436" width="1242" height="2436">
  <defs>
    <linearGradient id="splashBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B0F19"/>
      <stop offset="50%" stop-color="#070A12"/>
      <stop offset="100%" stop-color="#020408"/>
    </linearGradient>

    <radialGradient id="splashGlow" cx="50%" cy="42%" r="40%">
      <stop offset="0%" stop-color="#00F5A0" stop-opacity="0.10"/>
      <stop offset="50%" stop-color="#0EA5E9" stop-opacity="0.02"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="spG1" x1="100%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#00F5A0"/>
      <stop offset="100%" stop-color="#00D2B4"/>
    </linearGradient>
    <linearGradient id="spG2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00D2B4"/>
      <stop offset="100%" stop-color="#0EA5E9"/>
    </linearGradient>
    <linearGradient id="spG3" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0EA5E9"/>
      <stop offset="100%" stop-color="#00F5A0"/>
    </linearGradient>

    <filter id="splashFilter" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="22" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1242" height="2436" fill="url(#splashBg)"/>
  <circle cx="{cx}" cy="{cy}" r="500" fill="url(#splashGlow)"/>

  <!-- Centered Emblem -->
  <g filter="url(#splashFilter)">
    <path d="{d1}" fill="none" stroke="url(#spG1)" stroke-width="{stroke_w}" stroke-linecap="round"/>
    <path d="{d2}" fill="none" stroke="url(#spG2)" stroke-width="{stroke_w}" stroke-linecap="round"/>
    <path d="{d3}" fill="none" stroke="url(#spG3)" stroke-width="{stroke_w}" stroke-linecap="round"/>
    <circle cx="{cx}" cy="{cy}" r="9" fill="#00F5A0"/>
  </g>

  <!-- Centered Title Case Wordmark -->
  <text x="{cx}" y="{cy + 280}" text-anchor="middle" font-family="'Liberation Sans', 'Inter', -apple-system, sans-serif" font-size="76" font-weight="700" letter-spacing="-1.5px">
    <tspan fill="#FFFFFF">Trip</tspan><tspan fill="#00F5A0">Circle</tspan>
  </text>
  <text x="{cx}" y="{cy + 336}" text-anchor="middle" fill="#64748B" font-family="'Liberation Sans', 'Inter', -apple-system, sans-serif" font-size="15" font-weight="600" letter-spacing="6px">SHARED TRIP LEDGER</text>
</svg>"""

def render_svg_to_png(svg_path, png_path, width, height):
    cmd = [
        "inkscape",
        str(svg_path),
        "-o",
        str(png_path),
        "-w",
        str(width),
        "-h",
        str(height)
    ]
    subprocess.run(cmd, check=True)

def main():
    print("Generating TripCircle brand assets...")

    # 1. icon.svg
    icon_svg = ASSETS_DIR / "icon.svg"
    icon_svg.write_text(generate_icon_svg(transparent_bg=False))
    print(f"✓ Wrote {icon_svg}")

    # 2. icon.png (1024x1024)
    icon_png = ASSETS_DIR / "icon.png"
    render_svg_to_png(icon_svg, icon_png, 1024, 1024)
    print(f"✓ Rendered {icon_png} (1024x1024)")

    # 3. adaptive-icon.png (1024x1024, transparent foreground)
    temp_adaptive_svg = Path("/tmp/tripcircle_adaptive.svg")
    temp_adaptive_svg.write_text(generate_icon_svg(transparent_bg=True))
    adaptive_png = ASSETS_DIR / "adaptive-icon.png"
    render_svg_to_png(temp_adaptive_svg, adaptive_png, 1024, 1024)
    print(f"✓ Rendered {adaptive_png} (1024x1024 transparent)")

    # 4. splash.png (1242x2436)
    splash_svg = Path("/tmp/tripcircle_splash.svg")
    splash_svg.write_text(generate_splash_svg())
    splash_png = ASSETS_DIR / "splash.png"
    render_svg_to_png(splash_svg, splash_png, 1242, 2436)
    print(f"✓ Rendered {splash_png} (1242x2436)")

    # 5. favicon.png (48x48)
    favicon_png = ASSETS_DIR / "favicon.png"
    render_svg_to_png(icon_svg, favicon_png, 48, 48)
    print(f"✓ Rendered {favicon_png} (48x48)")

    # 6. logo.svg
    logo_svg = ASSETS_DIR / "logo.svg"
    logo_svg.write_text(generate_logo_svg(transparent_bg=False))
    print(f"✓ Wrote {logo_svg}")

    # 7. logo.png (800x240)
    logo_png = ASSETS_DIR / "logo.png"
    render_svg_to_png(logo_svg, logo_png, 800, 240)
    print(f"✓ Rendered {logo_png} (800x240)")

    print("\nTripCircle brand assets successfully generated!")

if __name__ == "__main__":
    main()
