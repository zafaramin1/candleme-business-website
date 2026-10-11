(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,100068,e=>{"use strict";var t=e.i(843476),o=e.i(271645),i=e.i(207670);let a=`
  attribute vec2 aPosition;
  varying vec2 vUv;
  
  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`,r=`
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;
uniform float uTiltX;
uniform float uBlowStrength;
uniform float uStartupProgress;
uniform float uExtinguished;
uniform vec2 uPosition;

uniform float uTouchX;
uniform float uTouchY;
uniform float uTouchProximity;
uniform float uTouchDwell;
uniform float uTapBurst;
uniform float uTapExtinguish;
uniform float uShake;

#define Bloom 0.08
#define VerticalMotion 0.012
#define HorizontalMotion 0.4

float hash(float n) { return fract(sin(n) * 43758.5453123); }

float noise(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), f);
}

float fbm(float x) {
  float v = 0.0;
  v += noise(x) * 0.5;
  v += noise(x * 2.0) * 0.25;
  v += noise(x * 4.0) * 0.125;
  return v;
}

void main() {
  vec2 uv = vUv;
  vec2 nuv = uv;
  float aspect = uResolution.x / uResolution.y;
  nuv.x *= aspect * 0.3;
  uv.y += 0.025;

  float idleTime = mod(uTime, 628.318);

  vec2 pos = uv * 7.0 - vec2(1.0, 1.0);
  vec2 rawPos = uv * 7.0 - vec2(1.0, 1.0);
  rawPos.y -= 0.455;
  float rawHeightRatio = clamp((rawPos.y + 0.5) / 1.5, 0.0, 1.0);
  float tiltFactor = pow(rawHeightRatio, 2.0);

  pos.x -= uPosition.x * 2.0;
  pos.y -= uPosition.y * 2.0;

  pos.y -= 0.65;

  float startup = uStartupProgress;

  float startupScale = 0.05 + startup * 0.95;
  float anchorY = -0.5;
  pos.y = anchorY + (pos.y - anchorY) / max(startupScale, 0.01);
  // Grow the visible flame upward while keeping its foot fixed on the wick.
  pos.y = anchorY + (pos.y - anchorY) / 1.3;

  float widthProgress = startup * startup;
  float widthScale = mix(0.65, 1.0, widthProgress);
  pos.x /= widthScale;

  float heightRatio = clamp((pos.y + 0.5) / 1.5, 0.0, 1.0);

  float tiltAmount = uTiltX * 1.35 * tiltFactor;

  float blow = uBlowStrength;
  float blowLean = blow * 0.25 * tiltFactor;

  // === TILT TURBULENCE & MICRO-OSCILLATIONS ===
  float absTilt = abs(uTiltX);
  
  // ---> NEW: Subtle Asymmetry Tilt (Breaks the perfect vertical center)
  float baselineAsymmetry = (noise(uTime * 0.4) - 0.5) * 0.07 * tiltFactor;
  pos.x += baselineAsymmetry;

  // Base flutter that increases as you tilt
  float tiltTurbulence = sin(uTime * 38.0) * 0.035 * absTilt;
  
  // Chaotic noise that only kicks in during extreme tilt
  float extremeTilt = smoothstep(0.25, 0.6, absTilt); 
  tiltTurbulence += (noise(uTime * 55.0) - 0.5) * 0.12 * extremeTilt;
  
  pos.x += tiltTurbulence * tiltFactor;
  // Make the flame struggle/bob vertically slightly when tilted hard
  pos.y += (noise(uTime * 45.0) - 0.5) * 0.05 * extremeTilt * tiltFactor;

  float blowFlicker = 0.0;
  blowFlicker += sin(uTime * 25.0) * 0.07 * blow;
  blowFlicker += sin(uTime * 37.0) * 0.05 * blow;
  blowFlicker += sin(uTime * 53.0 + 2.0) * 0.035 * blow;
  blowFlicker += (noise(uTime * 40.0) - 0.5) * 0.12 * blow;
  blowFlicker *= tiltFactor;

  //if flame moves from wick change the uTiltx multiplier (0.75)
  pos.x += tiltAmount - (uTiltX * 0.75) + blowLean + blowFlicker;
  float horizontalVariation = sin(idleTime * 0.8) * uv.y * (sin(idleTime * 0.7 - uv.y) + cos((idleTime * 0.5 - uv.y) * 0.1)) * 0.5 * HorizontalMotion;
  horizontalVariation *= tiltFactor;
  // Increase only approach-driven motion by 20%; preserve idle and tap effects.
  float approachMotion = uTouchProximity * 1.40;
  float airCurrentIntensity = 0.25 + max(approachMotion * 0.75, blow * 2.0);
  pos.x += horizontalVariation * airCurrentIntensity;

  float idleBob = VerticalMotion * 0.8 * sin(idleTime * 0.6);
  float proximityBob = VerticalMotion * 1.5 * fract(sin(30.0 * uTime * 0.3)) * approachMotion;
  pos.y += idleBob + proximityBob;

  float shrinkAmount = blow * 0.5;
  shrinkAmount += sin(uTime * 15.0) * 0.15 * blow;
  shrinkAmount += sin(uTime * 8.0) * 0.1 * blow;
  pos.y *= (1.0 + clamp(shrinkAmount, 0.0, 1.5));

  // === IDLE ANIMATION ===
  float h = heightRatio;
  float h2 = h * h;
  float h3 = h2 * h;

  float PI2 = 6.28318;

  float slowTime1 = idleTime * 0.15;
  float slowTime2 = idleTime * 0.11;
  float slowTime3 = idleTime * 0.07;

  // ---> RANDOM-IDLE SWAY: fbm-driven wander, no fixed period.
  // fbm is smooth (no hash snaps) but irregular — leans, drifts back, pauses
  // near turning points. Slow freq + separate slower amp modulation = the
  // back-and-forth rhythm never repeats. sin() only adds a micro-breath.
  // Tune: 0.16 = lean speed, 0.07 = amp-drift speed, 0.18..0.30 = lean range.
  float leanDir = (fbm(uTime * 0.16) - 0.5) * 2.0;          // -1..1 smooth
  float leanAmp = 0.36 + fbm(uTime * 0.07 + 100.0) * 0.24; // 0.36..0.60
  float idleSway = leanDir * leanAmp;
  idleSway += sin(uTime * 1.7) * 0.01;                     // micro-breath, held lean still lives
  // Softer curve (h^1.5): bends more at the tip, less at the base = natural lean.
  pos.x += idleSway * pow(h, 1.5);

  // === CRACKLE === quick sharp flame spasm (hard lean + stretch + bulge + flash).
  // Spike train per period; hash-gated so a fraction of periods fire. exp decay = brief.
  // Tune: 1.0 = period (sec), 0.45 = fire chance (raise = rarer), 22.0 = spike sharpness.
  float crackleClock = uTime * 0.6;
  float crackleEvt = floor(crackleClock);
  float crackleF = fract(crackleClock);
  float crackleGate = exp(-crackleF * crackleF * 22.0) * step(0.78, hash(crackleEvt * 1.7));
  float crackleDir = sign(hash(crackleEvt * 3.3) - 0.5);

  float proximitySway = 0.0;
  proximitySway += sin(uTime * 3.0) * 0.2 * approachMotion;
  proximitySway += sin(uTime * 4.5 + 1.0) * 0.1 * approachMotion;
  pos.x += proximitySway * h2;

  float idleWave = sin(slowTime2 * PI2 - h * 2.5) * 0.03 * h;
  float proximityWave = sin(uTime * 3.5 - h * 4.0) * 0.15 * h * approachMotion;
  pos.x += idleWave + proximityWave;

  float idleWidthScale = 1.0 + sin(slowTime1 * PI2 * 0.7) * 0.04;
  idleWidthScale += sin(slowTime3 * PI2 * 1.3 + 0.8) * 0.02;
  pos.x *= idleWidthScale;

  float idleHeightScale = 1.0 + sin(slowTime2 * PI2 * 0.05) * 0.02;
  idleHeightScale += sin(slowTime1 * PI2 * 0.9 + 1.0) * 0.01;
  pos.y *= mix(1.0, idleHeightScale, h);

  // === TOUCH INTERACTIONS ===
  float proxCubed = uTouchProximity * uTouchProximity * uTouchProximity;
  float shrinkFactor = 1.0 + proxCubed * 1.0;
  pos.y *= shrinkFactor;

  float pinchFactor = 1.0 - uTouchProximity * uTouchProximity * 0.2;
  pos.x /= max(pinchFactor, 0.5);

  // Equal-distance touches should flicker with the same timing on either side.
  float proximityFlicker = approachMotion * 0.05 * sin(uTime * 15.0 + abs(uTouchX) * 5.0);
  pos.x += sign(uTouchX) * proximityFlicker * tiltFactor;

  float pushAmount = approachMotion * (1.0 - uTouchDwell) * 1.0 * tiltFactor;
  vec2 touchDir = vec2(uTouchX, uTouchY);
  float touchLen = length(touchDir);
  if (touchLen > 0.01) {
    vec2 pushDir = touchDir / touchLen;
    pos.x += pushDir.x * pushAmount;
  }

  float attractAmount = uTouchDwell * uTouchProximity * 0.5 * tiltFactor;
  pos.x -= uTouchX * attractAmount * 0.4;
  pos.y -= uTouchY * attractAmount * 0.4;

  float touchTurbulence = approachMotion * 0.04 * sin(uTime * 12.0) * tiltFactor;
  pos.x += sign(uTouchX) * touchTurbulence;

  // === SHAKE ANIMATION ===
  float shake = uShake;

  if (shake > 0.0) {
    float shakeIntensity = shake * shake;

    float shakeShrink = shakeIntensity * shakeIntensity * shakeIntensity;
    float shakeShrinkFactor = 1.0 + shakeShrink * 1.5;
    pos.y *= shakeShrinkFactor;

    float shakePinch = 1.0 - shakeIntensity * shakeIntensity * 0.25;
    pos.x /= max(shakePinch, 0.5);

    float tipSwayAmount = 0.0;
    tipSwayAmount += sin(uTime * 8.0) * 0.35 * shakeIntensity;
    tipSwayAmount += sin(uTime * 12.0 + 0.5) * 0.25 * shakeIntensity;
    tipSwayAmount += sin(uTime * 5.0 + 1.0) * 0.2 * shakeIntensity;
    tipSwayAmount += sin(uTime * 18.0 + 2.0) * 0.15 * shakeIntensity;

    float swayH = max(0.0, (h - 0.1) / 0.9);
    float swayFactor = swayH * swayH;
    pos.x += tipSwayAmount * swayFactor;

    float shakeFlicker = shakeIntensity * 0.08 * sin(uTime * 15.0);
    shakeFlicker += shakeIntensity * 0.05 * sin(uTime * 23.0);
    pos.x += shakeFlicker * tiltFactor;

    float shakeY = sin(uTime * 20.0) * 0.02 * shakeIntensity;
    pos.y += shakeY;
  }

  // === TAP EXTINGUISH ANIMATION ===
  float tapExt = uTapExtinguish;

  if (tapExt > 0.0) {
    float phase1 = smoothstep(0.0, 0.5, tapExt);
    float phase2 = smoothstep(0.5, 0.85, tapExt);
    float phase3 = smoothstep(0.85, 1.0, tapExt);

    float proximityAmount = phase1 * 0.5 + phase2 * 0.4 + phase3 * 0.1;
    float proxCubed = proximityAmount * proximityAmount * proximityAmount;
    float extShrinkFactor = 1.0 + proxCubed * 3.0;
    pos.y *= extShrinkFactor;

    float shrinkProgress = phase1 * 0.3 + phase2 * 0.5 + phase3 * 0.2;
    float pushDown = shrinkProgress * 2.5;
    pos.y += pushDown;

    float extPinchAmount = phase1 * 0.3 + phase2 * 0.5 + phase3 * 0.2;
    float extPinchFactor = 1.0 - extPinchAmount * extPinchAmount * 0.5;
    pos.x /= max(extPinchFactor, 0.3);

    float flickerIntensity = phase1 * 0.064 + phase2 * 0.096;
    float nervousFlicker = flickerIntensity * sin(uTime * 15.0 + pos.x * 5.0);
    nervousFlicker += flickerIntensity * 1.5 * sin(uTime * 23.0);
    pos.x += nervousFlicker * tiltFactor;

    float swayIntensity = phase1 * 0.72 + phase2 * 1.0 - phase3 * 0.4;
    float tipSway = sin(uTime * 8.0) * swayIntensity;
    tipSway += sin(uTime * 12.0 + 0.5) * swayIntensity * 1.7;
    tipSway += sin(uTime * 5.0 + 1.0) * swayIntensity * 1.9;
    float adjustedH = max(0.0, (h - 0.1) / 0.9);
    float swayFactor = adjustedH * adjustedH;
    pos.x += tipSway * swayFactor;

    float extTurbulence = extPinchAmount * 0.944 * sin(uTime * 12.0) * tiltFactor;
    pos.x += extTurbulence;
  }

  float baseH = smoothstep(0.9, 0.0, heightRatio);
  float baseCurve = baseH * baseH * 2.0;

  float baseXCurve = 1.0 + baseH * 0.1;
  pos.x *= baseXCurve;

  float p = 0.001;

  float baseProximity = 0.5;
  float effectiveProximity = max(baseProximity, uTouchProximity);
  float idleWidthVar = sin(idleTime * 1.1) * 0.04 + (fbm(idleTime * 0.8) - 0.5) * 0.03;
  float proximityWidthVar = (sin(idleTime * 2.0) * 0.06 + (fbm(idleTime * 1.5) - 0.5) * 0.05) * effectiveProximity;

  float blowWidthVar = blow * 1.5;
  blowWidthVar += sin(uTime * 22.0) * 0.8 * blow;
  blowWidthVar += sin(uTime * 35.0) * 0.4 * blow;

  float baseFlameWidth = 5.5 + idleWidthVar + proximityWidthVar + blowWidthVar;

  float actualLean = abs(pos.x) * heightRatio;
  float tiltMag = abs(uTiltX) + abs(blowLean) + actualLean * 0.5;
  
  // Preserve the existing tip response while the base profile below controls
  // where the body carries its visual weight.
  float tipSharpness = 1.2 + tiltMag * 5.5;

  // Lantern profile: leave a narrow neck at the wick, open quickly into the
  // lower third, then spend the rest of the height tapering toward the tip.
  // Keeping this entirely width-based preserves the approved flame height.
  float shoulderRise = smoothstep(0.03, 0.27, heightRatio);
  float shoulderFall = 1.0 - smoothstep(0.30, 0.90, heightRatio);
  float lowerBodyBulge = shoulderRise * shoulderFall * 3.6;
  float wickNeck = (1.0 - smoothstep(0.02, 0.16, heightRatio)) * 1.0;
  float longTaper = smoothstep(0.30, 1.0, heightRatio) * 0.85;

  float upperTaper = smoothstep(0.68, 1.0, heightRatio);
  upperTaper *= upperTaper;
  float flameWidth = baseFlameWidth + lowerBodyBulge - wickNeck - longTaper
    - tipSharpness * heightRatio * heightRatio;
  flameWidth -= upperTaper * 0.72;
  flameWidth += crackleGate * 1.5; // CRACKLE: brief shape bulge (visible fat pulse)

  // Safety floor for hard interaction states; the idle tip stays above it.
  flameWidth = max(flameWidth, 1.1);

  flameWidth *= (1.0 - uTapBurst * 0.05);

  // A quiet, irregular pulse keeps the point alive without changing its height,
  // base, or average footprint. Both effects fade out before the flame body.
  float tipPulse = (fbm(idleTime * 0.9 + 31.0) - 0.4375) * 0.10;
  float topPinch = upperTaper * (0.56 + tipPulse);
  pos.x *= (1.0 + topPinch);

  float tipFlutter = (fbm(idleTime * 1.35 + 73.0) - 0.4375) * 0.032;
  tipFlutter += sin(idleTime * 2.1 + 0.7) * 0.006;
  pos.x += tipFlutter * upperTaper;

 // ---> TWEAK: Organic Edge Waviness (1-2px Irregularity)
  float broadSway = (fbm(pos.y * 6.0 - uTime * 3.0) - 0.5) * 0.035;
  float microWobble = sin(pos.y * 10.0 - uTime * 5.0) * 0.01; 
  
  pos.x += (broadSway + microWobble) * heightRatio;

  float y = pow(abs(pos.x), flameWidth) / (1.0 * p) * 1.0;

  float flame_out = length(pos + vec2(pos.x, y)) * 0.5;

  vec3 color = vec3(0.0);

  float verticalBias = smoothstep(-0.35, 0.88, pos.y);

  float PI2_color = 6.28318;
  float slowTimeA = idleTime * 0.15 * PI2_color;
  float slowTimeB = idleTime * 0.11 * PI2_color;

  float heightPulse = 1.0 + sin(slowTimeA * -0.5) * 0.08 + sin(slowTimeB * 1.1) * 0.04;
  float adjustedFlameOut = flame_out * heightPulse;

  float radialDist = length(vec2(pos.x * 1.5, pos.y + 0.05));
  
  // ---> TWEAK: Pinpoint Center Glow
  float centerGlow = smoothstep(1.15, 0.0, radialDist);
  float extremeGlowMask = smoothstep(0.0, 0.9, heightRatio) * pow(centerGlow, 2.0);

  // ---> TWEAK: Soft Edge Gradient
  float softEdge = smoothstep(-0.15, 0.5, 0.6 - adjustedFlameOut);
  color.rg += softEdge * (0.8 + verticalBias * 0.25) * (1.0 + extremeGlowMask * 3.5);

  float wickFade = smoothstep(-0.15, -0.8, pos.y);
  float uShape = smoothstep(0.35, 0.0, abs(pos.x));
  float smoothOrangeMask = wickFade * uShape;
  vec3 deepOrange = vec3(0.5, 0.08, 0.0);
  color = mix(color, deepOrange, smoothOrangeMask * 0.9);

  color.g /= 3.1;

  float baseDarken = smoothstep(0.0, 0.2, heightRatio);
  float darkenAmount = 0.85;
  color.rg *= mix(darkenAmount, 1.0, baseDarken);

  color += pow(color.r, 1.0) * 0.65;

  float colorCycle = sin(slowTimeA * 0.4) * 0.5 + 0.5;
  float colorCycle2 = sin(slowTimeB * 0.6 + 1.0) * 0.5 + 0.5;

  float warmShift = colorCycle * 0.06;
  color.r += warmShift;
  color.g -= warmShift * 0.3;

  float goldenShift = colorCycle2 * 0.04;
  color.r += goldenShift * 0.5;
  color.g += goldenShift;

  float blueShift = sin(slowTimeA * 0.25) * 0.02 * (1.0 - heightRatio);
  color.b += max(0.0, blueShift);

  // ---> TWEAKED: Increased flicker intensity multipliers
  float flicker = 1.0;
  flicker += sin(slowTimeA * 0.8) * 0.04;           // Was 0.012
  flicker += sin(slowTimeB * 2.0) * 0.025;          // Was 0.008
  float flickerProximity = max(0.5, uTouchProximity);
  flicker += sin(idleTime * 6.0) * 0.08 * flickerProximity;   // Was 0.03
  flicker += sin(idleTime * 11.0) * 0.05 * flickerProximity;  // Was 0.02
  
  // === TILT LIGHTING INSTABILITY ===
  float tiltFlicker = sin(uTime * 42.0) * 0.05 * absTilt;
  tiltFlicker += (noise(uTime * 65.0) - 0.5) * 0.15 * extremeTilt;
  flicker += tiltFlicker;
  
  // === CRACKLE BRIGHTNESS POP (paired with positional crackle above) ===
  // (moved to gl_FragColor to bypass color clamp)

  // ---> TWEAKED: Widened the clamp so the brighter/darker flickers don't get chopped off
  color *= clamp(flicker, 0.5, 1.5);                // Was 0.75, 1.25

  float warm = sin(slowTimeB * 0.7) * 0.02;
  color.r += warm;
  color.g += warm * 0.15;

  float blowDim = blow * 0.5;
  blowDim += sin(uTime * 18.0) * 0.15 * blow;
  blowDim += sin(uTime * 31.0) * 0.1 * blow;
  blowDim += (noise(uTime * 25.0) - 0.5) * 0.25 * blow;
  color *= (1.0 - clamp(blowDim, 0.0, 0.85));

  color.b += blow * 0.1;
  color.r -= blow * 0.15;

  if (uShake > 0.0) {
    float shakeFlicker = 1.0;
    shakeFlicker += sin(uTime * 25.0) * 0.08 * uShake;
    shakeFlicker += sin(uTime * 37.0) * 0.05 * uShake;
    shakeFlicker += (noise(uTime * 50.0) - 0.5) * 0.15 * uShake;
    color *= clamp(shakeFlicker, 0.7, 1.3);

    color.b += uShake * 0.05;
    color.r -= uShake * 0.03;
  }

  color *= (1.0 - uTouchProximity * 0.25);

  color *= (1.0 + uTapBurst * 1.2);
  color.r += uTapBurst * 0.15;
  color.g += uTapBurst * 0.05;

  if (uTapExtinguish > 0.0) {
    float extPhase1 = smoothstep(0.0, 0.5, uTapExtinguish);
    float extPhase2 = smoothstep(0.5, 0.85, uTapExtinguish);
    float extPhase3 = smoothstep(0.85, 1.0, uTapExtinguish);

    float proximityDim = extPhase1 * 0.15 + extPhase2 * 0.35 + extPhase3 * 0.5;
    color *= (1.0 - proximityDim);

    float intensityFlicker = sin(uTime * 11.0) * 0.04 * extPhase1;
    intensityFlicker += sin(uTime * 17.0) * 0.06 * extPhase2;
    color *= (1.0 + intensityFlicker);
  }

  // Keep warmth at the wick and a pale yellow transition into the bright tip.
  // Follow the existing brightness so dim, translucent edges stay soft.
  float whiteRegion = smoothstep(0.16, 0.7, heightRatio);
  float whiteStrength = whiteRegion * smoothstep(0.0, 0.55, color.r);
  color.g = mix(color.g, color.r * 0.96, whiteStrength * 0.72);
  color.b = mix(color.b, color.r * 0.88, whiteStrength * 0.75);
  // Reserve the strongest whitening for the upper flame, not the whole body.
  float whiteTip = smoothstep(0.7, 0.92, heightRatio);
  color.g = mix(color.g, color.r, whiteTip);
  color.b = mix(color.b, color.r * 0.98, whiteTip);

  float alpha = min(1.0, startup * 3.0);
  alpha *= (1.0 - uExtinguished);

  if (uTapExtinguish > 0.0) {
    float fade1 = smoothstep(0.0, 0.5, uTapExtinguish) * 0.2;
    float fade2 = smoothstep(0.5, 0.85, uTapExtinguish) * 0.4;
    float fade3 = smoothstep(0.85, 1.0, uTapExtinguish) * 0.4;
    float tapFade = fade1 + fade2 + fade3;
    alpha *= (1.0 - tapFade);
  }

 // === THE BOWL CUTOFF MASK ===
  float xDist = pos.x * pos.x;
  float tiltOffset = (uTiltX * 1.5 + blowLean) * heightRatio;
  
  float ovalCutoff = -0.45 - xDist * 1.5 - abs(tiltOffset) * 0.4;
  alpha *= smoothstep(ovalCutoff - 0.2, ovalCutoff + 0.2, pos.y);

  float tiltMagnitude = abs(uTiltX) + abs(blowLean);
  float tipBleedFade = smoothstep(0.6, 0.95, heightRatio) * tiltMagnitude * 1.5;
  alpha *= (1.0 - clamp(tipBleedFade, 0.0, 1.0));

  // === BLUE CURVED LINES AT BASE ===
  float vCenterY = -0.67;
  float vSlope = 0.15;
  float vThickness = 0.5;

  float xAbs = abs(pos.x);
  float vCurve = vCenterY + pow(xAbs, 1.0) * vSlope;
  float distToV = abs(pos.y - vCurve);

  float vMask = smoothstep(vThickness, vThickness * 0.2, distToV);
  float centerFade = smoothstep(0.5, 0.3, xAbs);
  vMask *= centerFade;
  float vTopFade = smoothstep(0.2, -1.0, pos.y);
  vMask *= vTopFade;
  float vSideFade = smoothstep(1.2, 0.3, xAbs);
  vMask *= vSideFade;

// === BLUE FLAME BASE ===
  float baseDist = length(vec2(pos.x * 0.9, pos.y + 0.5));
  float baseMask = smoothstep(0.35, 0.0, baseDist);
  color += vec3(-0.3, 0.3, 0.75) * baseMask * 1.5;

  // === GLOBAL HOLLOW MASK ===
  float edgeDist = abs(pos.x) / max(flameWidth, 0.001);
  float hollowCurve = smoothstep(0.0, 0.55, edgeDist);
  float hollowMultiplier = mix(0.85, 1.0, hollowCurve);
  color *= hollowMultiplier;

  // === INNER CORE 'n' SHAPE HOLLOW MASK ===
  float nOuterDist = length(vec2(pos.x * 1.0, pos.y - 0.01));
  float nOuterMask = smoothstep(0.35, 0.0, nOuterDist);
  float nInnerDist = length(vec2(pos.x * 1.0, pos.y - 0.01));
  float nInnerMask = smoothstep(0.001, 0.0, nInnerDist);
  float nShapeMask = nOuterMask * (1.0 - nInnerMask);
  color *= mix(1.0, 0.65, nShapeMask);

  float luminance = dot(color, vec3(0.400, 0.400, 0.400));
  color = clamp(color, 0.0, 1.0);
  
  // ---> TWEAK: Edge Transparency
  float edgeAlpha = smoothstep(-0.1, 0.4, 0.6 - adjustedFlameOut);
  
  // CRACKLE final pop — applied to gl_FragColor so it bypasses the color clamp above.
  vec3 crackleColor = vec3(1.0, 0.9, 0.7); // warm white flash tint
  gl_FragColor = vec4(color, luminance * alpha * edgeAlpha);
  gl_FragColor.rgb += crackleGate * 0.28 * crackleColor;
  gl_FragColor.a *= (1.0 + crackleGate * 0.2);
}
`;function l(e,t,o){let i=e.createShader(o);return i?(e.shaderSource(i,t),e.compileShader(i),e.getShaderParameter(i,e.COMPILE_STATUS))?i:(console.error("Shader compile error:",e.getShaderInfoLog(i)),e.deleteShader(i),null):null}let s=(0,o.memo)((0,o.forwardRef)(function({hueRotateDeg:e=0,saturate:s=1,brightness:n=1,disabled:h=!1,className:u,inputsRef:c,frameStateRef:f,positionX:p=0,positionY:m=0,paused:d=!1,immediate:g=!1,onReady:T,allowVerticalScroll:x=!1},y){let w=h||!c,b=(0,o.useRef)(null),k=(0,o.useRef)(null),v=(0,o.useRef)(null),S=(0,o.useRef)(null),[A,F]=(0,o.useState)(!1),P=(0,o.useRef)(1),E=(0,o.useRef)(!1),R=(0,o.useRef)(d),I=(0,o.useRef)(g),M=(0,o.useRef)(0),L=(0,o.useRef)({opacity:1}),C=(0,o.useRef)({duration:0,extinguished:!1,recoveryTime:0,smoothedBlow:0}),B=(0,o.useRef)({progress:0,started:!1});(0,o.useEffect)(()=>{R.current=d},[d]),(0,o.useEffect)(()=>{A&&T?.()},[A,T]),(0,o.useEffect)(()=>{if(I.current=g,g){let e=B.current;e.progress=1,e.started=!0}},[g]),(0,o.useImperativeHandle)(y,()=>({setSpeed(e){P.current=e},resetStartup(){let e=B.current;e.progress=0,e.started=!1;let t=C.current;t.extinguished=!1,t.duration=0,t.recoveryTime=0,L.current.opacity=1},isStartingUp:()=>B.current.progress<1})),(0,o.useEffect)(()=>{let e,t=b.current;if(!t)return;E.current=!1;let o=performance.now(),i=o,s={active:!1,nextAt:4+6*Math.random(),startTime:0,attack:0,peak:0,decayRate:3,value:0},n="u">typeof document&&document.hidden,h={clientWidth:280,clientHeight:448,dpr:1},u=()=>{h.clientWidth=t.clientWidth||280,h.clientHeight=t.clientHeight||448,h.dpr=window.devicePixelRatio||1;let e=Math.floor(h.clientWidth*h.dpr),o=Math.floor(h.clientHeight*h.dpr);(t.width!==e||t.height!==o)&&(t.width=e,t.height=o)},d=()=>{(n=document.hidden)||u()},g=null,T=null,x=null,y=null,w=null,A=null,W=null,D=null,O=null,H=null,U=null,N=null,X=null,_=null,Y=null,G=null,K=e=>{let o,i=l(e,a,e.VERTEX_SHADER),s=l(e,r,e.FRAGMENT_SHADER);if(!i||!s)return!1;let n=(o=e.createProgram())?(e.attachShader(o,i),e.attachShader(o,s),e.linkProgram(o),e.getProgramParameter(o,e.LINK_STATUS))?o:(console.error("Program link error:",e.getProgramInfoLog(o)),e.deleteProgram(o),null):null;if(!n)return!1;T=n,S.current=n,e.useProgram(n);let h=new Float32Array([-1,-1,1,-1,-1,1,1,1]),u=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,u),e.bufferData(e.ARRAY_BUFFER,h,e.STATIC_DRAW);let c=e.getAttribLocation(n,"aPosition");return e.enableVertexAttribArray(c),e.vertexAttribPointer(c,2,e.FLOAT,!1,0,0),x=e.getUniformLocation(n,"uTime"),y=e.getUniformLocation(n,"uResolution"),w=e.getUniformLocation(n,"uTiltX"),A=e.getUniformLocation(n,"uBlowStrength"),W=e.getUniformLocation(n,"uStartupProgress"),D=e.getUniformLocation(n,"uExtinguished"),O=e.getUniformLocation(n,"uPosition"),H=e.getUniformLocation(n,"uTouchX"),U=e.getUniformLocation(n,"uTouchY"),N=e.getUniformLocation(n,"uTouchProximity"),X=e.getUniformLocation(n,"uTouchDwell"),_=e.getUniformLocation(n,"uTapBurst"),Y=e.getUniformLocation(n,"uTapExtinguish"),G=e.getUniformLocation(n,"uShake"),e.uniform2f(y,t.width,t.height),e.uniform2f(O,p,m),e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA),!0},V=e=>{e.preventDefault(),F(!1)},j=()=>{let e=v.current;e&&K(e)&&(u(),F(!0))};return(()=>{let a=t.getContext("webgl",{alpha:!0,premultipliedAlpha:!1,antialias:!0});if(!a)return console.error("WebGL not supported");if(v.current=a,!K(a))return;u(),"u">typeof ResizeObserver&&(g=new ResizeObserver(u)).observe(t),window.addEventListener("resize",u,{passive:!0}),document.addEventListener("visibilitychange",d),t.addEventListener("webglcontextlost",V,!1),t.addEventListener("webglcontextrestored",j,!1);let r=()=>{if(E.current)return;if(R.current||n||!T||a.isContextLost()){e=requestAnimationFrame(r);return}let l=performance.now(),u=(l-o)/1e3,d=Math.min(1/30,Math.max(0,(l-i)/1e3))||1/60;i=l;let g=c?.current??{tiltX:0,tiltY:0,blowStrength:0,touchX:0,touchY:0,touchProximity:0,touchDwell:0,tapBurst:0,tapExtinguish:0,shakeIntensity:0};if(!s.active&&u>=s.nextAt&&(s.active=!0,s.startTime=u,s.attack=.1+.05*Math.random(),s.peak=.3+.25*Math.random(),s.decayRate=3.8+1.6*Math.random()),s.active){let e=u-s.startTime;e<s.attack?s.value=s.peak*(e/s.attack):(s.value=s.peak*Math.exp(-(e-s.attack)*s.decayRate),s.value<.002&&(s.value=0,s.active=!1,s.nextAt=u+4+6*Math.random()))}let y=g.tiltX,b=g.blowStrength+s.value,v=g.touchX,S=g.touchY,F=g.touchProximity,O=g.touchDwell,K=g.tapBurst,V=g.tapExtinguish,j=g.shakeIntensity;j>M.current?M.current=Math.min(1,M.current+5*d*j):M.current=Math.max(0,M.current-15*d);let z=M.current,q=B.current,$=C.current,J=1-Math.exp(-d*(b>$.smoothedBlow?20:4));$.smoothedBlow+=(Math.min(1,b)-$.smoothedBlow)*J,b>.15?($.duration+=d*P.current*(1.5*b),$.recoveryTime=0,$.duration>=2&&!$.extinguished&&($.extinguished=!0,q.progress=0,q.started=!1)):($.extinguished||($.duration=Math.max(0,$.duration-.5*d)),$.recoveryTime+=d,$.extinguished&&$.recoveryTime>6&&($.extinguished=!1,$.duration=0,q.progress=0,q.started=!1));let Q=L.current;$.extinguished||V>.5?Q.opacity=Math.max(0,Q.opacity-.15*d):Q.opacity=Math.min(1,Q.opacity+2*d),I.current?(q.progress=1,q.started=!0):$.extinguished?(q.progress=0,q.started=!1):q.progress<1&&(q.started=!0,q.progress=Math.min(1,q.progress+d*P.current/1.5));let Z=I.current?1:1-Math.pow(1-q.progress,3),ee=h.dpr,et=.511*h.clientWidth*ee,eo=(h.clientHeight-48)*ee;a.viewport(et,.6*eo,t.width,eo),a.clearColor(0,0,0,0),a.clear(a.COLOR_BUFFER_BIT);let ei=u%100,ea=1+.5*$.smoothedBlow;a.uniform1f(x,ei*ea);let er=q.progress<1||$.extinguished,el=er?0:y,es=er?0:z;a.uniform1f(w,.9*el),a.uniform1f(A,$.smoothedBlow),a.uniform1f(W,Z),a.uniform1f(D,+!!$.extinguished),a.uniform1f(H,v),a.uniform1f(U,S),a.uniform1f(N,F),a.uniform1f(X,O),a.uniform1f(_,K),a.uniform1f(Y,V),a.uniform1f(G,es);let en=$.extinguished?0:Z*(1-.5*$.smoothedBlow),eh=en*(1+.5*es+.3*K);if(f){let e=f.current;e.intensity=en,e.lean=el,e.cracklePhase=u,e.overallEnergy=eh}let eu=`calc(65% + ${50*p}px)`;if(k.current){let e=L.current.opacity,t=.06*Math.sin(12*u)+.1*Math.sin(5*u);k.current.style.opacity=String(e*(.85+t)*(.7+.3*eh)),k.current.style.left=eu,k.current.style.bottom=`calc(298px + ${52*m}px)`;let o=298*Math.tan(6*el*Math.PI/180);k.current.style.transform=`translateX(calc(-50% + ${o}px))`}a.drawArrays(a.TRIANGLE_STRIP,0,4),e=requestAnimationFrame(r)};r(),F(!0)})(),()=>{E.current=!0,e&&cancelAnimationFrame(e),g&&g.disconnect(),window.removeEventListener("resize",u),document.removeEventListener("visibilitychange",d),t.removeEventListener("webglcontextlost",V),t.removeEventListener("webglcontextrestored",j),v.current&&S.current&&v.current.deleteProgram(S.current),v.current=null,S.current=null}},[c,f]);let W=`hue-rotate(${e}deg) saturate(${s}) brightness(${n})`;return(0,t.jsxs)("div",{className:(0,i.default)("relative",u),style:{width:280,height:448},children:[(0,t.jsx)("div",{ref:k,className:"absolute pointer-events-none",style:{width:7,height:5,left:"65%",bottom:298,transform:"translateX(-50%)",opacity:1,clipPath:"polygon(15% 10%, 80% 0%, 100% 40%, 90% 90%, 20% 100%, 0% 60%)",background:"radial-gradient(circle at center, #ffaa33 0%, #dd3300 60%, #880000 100%)",boxShadow:`
              0 0 4px 1px rgba(255, 68, 0, 0.7),
              0 0 8px 2px rgba(200, 20, 0, 0.3)
            `,filter:`${W} blur(0.6px)`,zIndex:3},children:(0,t.jsx)("div",{style:{position:"absolute",inset:"25%",background:"#ffddaa",filter:"blur(0.8px)",opacity:.6,borderRadius:"50%"}})}),(0,t.jsx)("canvas",{ref:b,width:280,height:448,className:(0,i.default)("flame-pixi-canvas relative z-10",w||x?"touch-pan-y":"touch-none"),suppressHydrationWarning:!0,style:{filter:W,width:280,height:448,opacity:+!!A,transition:"opacity 0.3s ease-out"}})]})}));e.s(["default",0,s],100068)}]);