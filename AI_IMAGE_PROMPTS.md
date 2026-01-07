# AI Image Generation Prompts

This file contains AI image generation prompts for creating custom game assets using tools like Bing Image Creator (DALL-E 3), Midjourney, or Leonardo.ai.

---

## 🦖 Natural History Museum - Dinosaur Skeletons

**Task:** Sort dinosaur skeletons by size (smallest to largest)  
**Tool:** Bing Image Creator (https://www.bing.com/create)  
**License:** Generated images are your property, free for commercial use  
**Target folder:** `v1/img/london/` or `v1/img/shared/dinosaurs/`

---

### 1️⃣ VELOCIRAPTOR (Small - 2m) - Order: 1

**Prompt:**
```
Velociraptor skeleton on display in natural history museum, full skeleton mounted on stand, museum hall background with high ceiling, professional museum photography, realistic lighting, visitor scale reference, scientific exhibit display, photorealistic, natural history museum interior, 2 meters long dinosaur
```

**Shortened version:**
```
Velociraptor skeleton, museum display, professional photo, 2m
```

**Filename:** `velociraptor_skeleton.jpg`

---

### 2️⃣ TRICERATOPS (Medium - 8m) - Order: 2

**Prompt:**
```
Triceratops skeleton full body on display in natural history museum, complete fossil skeleton with three horns and frill, museum exhibit hall with marble floors, professional museum photography, dramatic lighting, impressive size, natural history museum setting, photorealistic, 8 meters long
```

**Shortened version:**
```
Triceratops skeleton, museum exhibit hall, three horns, 8m
```

**Filename:** `triceratops_skeleton.jpg`

---

### 3️⃣ TYRANNOSAURUS REX (Large - 12m) - Order: 3

**Prompt:**
```
Tyrannosaurus Rex full skeleton display in natural history museum main hall, complete T-Rex fossil mounted in dynamic pose, grand museum interior with visitors for scale, professional museum photography, dramatic museum lighting, massive predator skeleton, photorealistic, natural history museum centerpiece, 12 meters long
```

**Shortened version:**
```
T-Rex skeleton, museum main hall, dramatic pose, 12m
```

**Filename:** `trex_skeleton.jpg`

---

### 4️⃣ BRACHIOSAURUS (Huge - 25m) - Order: 4

**Prompt:**
```
Brachiosaurus skeleton towering in natural history museum great hall, massive complete sauropod fossil reaching toward high ceiling, grand museum architecture with columns, professional museum photography, visitors walking below for scale, enormous long-neck dinosaur, photorealistic, museum masterpiece, 25 meters long, fills entire hall
```

**Shortened version:**
```
Brachiosaurus skeleton, towering museum hall, massive, 25m
```

**Filename:** `brachiosaurus_skeleton.jpg`

---

## 📋 Generation Workflow

### Using Bing Image Creator (Recommended - FREE):

1. **Open:** https://www.bing.com/create
2. **Sign in** with Microsoft account (free)
3. **Copy prompt** from above
4. **Paste** into Bing Creator
5. **Click "Create"** (wait 15 seconds)
6. **Review** 4 generated variations
7. **Download** best image
8. **Rename** to filename above
9. **Save** to appropriate folder
10. **Repeat** for other 3 dinosaurs

**Total time:** ~10-15 minutes for all 4 images

---

## 🎯 Style Consistency Tips

All prompts include:
- ✅ "natural history museum" - consistent location
- ✅ "professional museum photography" - same style
- ✅ "photorealistic" - realistic appearance
- ✅ Size mention (2m, 8m, 12m, 25m) - clear for sorting
- ✅ Museum interior context - authentic setting

**Result:** Consistent collection with clear size differences!

---

## 🔄 Alternative Dinosaurs

If you want to replace any:

### Replace Velociraptor (too small):
```
Deinonychus skeleton, museum display, raptor fossil, 3.5 meters long, natural history museum
```

### Replace Triceratops (too common):
```
Stegosaurus skeleton with distinctive back plates, museum hall, 9 meters long, natural history museum photography
```

### Replace Brachiosaurus (too tall):
```
Diplodocus skeleton, long sauropod dinosaur, museum hall, 27 meters long, natural history museum display
```

---

## 📝 JSON Implementation Example

```json
{
  "id": "NHM1",
  "name": "Natural History Museum",
  "type": "timepointer",
  "text": "Surikiuokite dinozaurų skeletus pagal dydį (nuo mažiausio iki didžiausio)",
  "lat": 51.4967,
  "lng": -0.1764,
  "points": 5,
  "attempts": 5,
  "time": 4,
  "events": [
    {
      "name": "Velociraptor",
      "order": 1,
      "text": "2m ilgio",
      "image": "velociraptor_skeleton.jpg"
    },
    {
      "name": "Triceratops",
      "order": 2,
      "text": "8m ilgio",
      "image": "triceratops_skeleton.jpg"
    },
    {
      "name": "Tyrannosaurus Rex",
      "order": 3,
      "text": "12m ilgio",
      "image": "trex_skeleton.jpg"
    },
    {
      "name": "Brachiosaurus",
      "order": 4,
      "text": "25m ilgio",
      "image": "brachiosaurus_skeleton.jpg"
    }
  ]
}
```

---

## ⚖️ Legal & Licensing

**Bing Image Creator (DALL-E 3) - Microsoft:**
- ✅ Images you create are your property
- ✅ Free for commercial use
- ✅ No attribution required
- ✅ Can use in mobile apps and games
- ✅ Can modify and adapt
- ✅ No royalties or ongoing fees

**Source:** Microsoft Bing Image Creator Terms of Service

---

## 🎨 Alternative AI Tools

If Bing is unavailable, try:

1. **Leonardo.ai** (https://leonardo.ai)
   - Free tier: 150 tokens/day
   - Commercial use allowed

2. **Playground AI** (https://playgroundai.com)
   - Free tier: 1000 images/day
   - Commercial use allowed

3. **Midjourney** ($10/month)
   - Highest quality
   - Professional results

---

## 📊 Expected Results

### Size Comparison:
- **Velociraptor:** Small, agile, visible in full frame
- **Triceratops:** Medium, impressive horns, partial hall view
- **T-Rex:** Large, dominant, dramatic pose, significant presence
- **Brachiosaurus:** Massive, towers to ceiling, fills entire frame

### Visual Consistency:
- All in museum setting
- Similar lighting style
- Professional photography look
- Clear size progression
- Scientific accuracy maintained

---

## ✅ Quality Checklist

Before using generated images, verify:
- ☑ Full skeleton visible
- ☑ Museum setting clear
- ☑ Good lighting and composition
- ☑ Size appropriate (matches prompt)
- ☑ High resolution (min 512x512)
- ☑ Photorealistic style
- ☑ No distortions or artifacts
- ☑ Consistent style across all 4

---

## 🚀 Status

- [ ] Velociraptor generated
- [ ] Triceratops generated
- [ ] T-Rex generated
- [ ] Brachiosaurus generated
- [ ] All images reviewed
- [ ] Images added to repository
- [ ] Task JSON created
- [ ] Task tested in app

---

**Last updated:** 2025-01-04  
**Author:** City Alert Development Team  
**Purpose:** Natural History Museum timepointer task assets


