import hashlib
from typing import List

class SimHashProcessor:
    def __init__(self, shingle_size: int = 3, hash_bits: int = 64):
        self.shingle_size = shingle_size
        self.hash_bits = hash_bits

    def _shingle_text(self, text: str) -> List[str]:
        words = text.split()
        if len(words) <= self.shingle_size:
            return [text]  # Use the whole text as a shingle if it's too short
        return [' '.join(words[i:i + self.shingle_size]) for i in range(len(words) - self.shingle_size + 1)]

    def compute_hash(self, text: str) -> int:
        if not text.strip():
            return 0

        shingles = self._shingle_text(text)
        vector = [0] * self.hash_bits

        for shingle in shingles:
            shingle_hash = int(hashlib.md5(shingle.encode()).hexdigest(), 16)
            for i in range(self.hash_bits):
                if shingle_hash & (1 << i):
                    vector[i] += 1
                else:
                    vector[i] -= 1

        sim_hash = 0
        for i in range(self.hash_bits):
            if vector[i] > 0:
                sim_hash |= (1 << i)

        return sim_hash

    def similarity(self, hash1: int, hash2: int) -> float:
        if hash1 == 0 or hash2 == 0:
            return 0.0

        xor = hash1 ^ hash2
        count = 0
        for i in range(self.hash_bits):
            if xor & (1 << i):
                count += 1

        return (self.hash_bits - count) / self.hash_bits

    def is_duplicate(self, text1: str, text2: str, threshold: float = 0.8) -> bool:
        hash1 = self.compute_hash(text1)
        hash2 = self.compute_hash(text2)
        return self.similarity(hash1, hash2) >= threshold
