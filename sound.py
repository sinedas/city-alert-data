import numpy as np
from scipy.io.wavfile import write

# Morse code mapping for "Bekit"
morse = {
    'B': '-...',
    'E': '.',
    'K': '-.-',
    'I': '..',
    'T': '-'
}

text = "BEKIT"

# Audio settings
sample_rate = 44100
dot_duration = 0.18  # seconds
dash_duration = dot_duration * 3
gap_intra = dot_duration  # between dots and dashes within a letter
gap_letter = dot_duration * 3
gap_word = dot_duration * 7

# Knock sound: short burst of noise with exponential decay (wood knock-like)
def knock(duration):
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    noise = np.random.uniform(-1, 1, t.shape)
    envelope = np.exp(-5 * t)  # quick decay
    return (noise * envelope * 0.5).astype(np.float32)

audio = np.array([], dtype=np.float32)

for char in text:
    if char == " ":
        audio = np.concatenate((audio, np.zeros(int(sample_rate * gap_word))))
        continue
    code = morse.get(char.upper(), "")
    for symbol in code:
        if symbol == '.':
            audio = np.concatenate((audio, knock(dot_duration)))
        elif symbol == '-':
            audio = np.concatenate((audio, knock(dash_duration)))
        audio = np.concatenate((audio, np.zeros(int(sample_rate * gap_intra))))
    audio = np.concatenate((audio, np.zeros(int(sample_rate * gap_letter))))

# Normalize audio
audio = audio / np.max(np.abs(audio))

filename = "/mnt/data/Bekit_knocking_morse.wav"
write(filename, sample_rate, audio)