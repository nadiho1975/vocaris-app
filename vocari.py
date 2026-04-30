import pandas as pd
import re

# 1. 파일 로드
df = pd.read_csv("app_vocab_master_rebuilt_examples_all_v19.csv")

# 2. 오탈자 교정 사전 (필요시 확장)
spell_fix = {
    "occation": "occasion",
    "apprecaite": "appreciate",
    "consturct": "construct"
}

def fix_word(w):
    return spell_fix.get(w, w)

df["word"] = df["word"].apply(fix_word)

# 3. 패턴 사전 (핵심 단어만)
pattern_dict = {
    "insist": "insist on / insist that",
    "depend": "depend on",
    "apply": "apply for / apply to",
    "focus": "focus on",
    "participate": "participate in",
    "rely": "rely on"
}

df["pattern"] = df["word"].map(pattern_dict)

# 4. 동의어 사전 (샘플)
syn_dict = {
    "abandon": "desert",
    "maintain": "insist",
    "assume": "presume",
    "claim": "assert",
    "predict": "forecast"
}

df["synonym"] = df["word"].map(syn_dict)

# 5. 예문 생성 (기본 템플릿)
def generate_example(word):
    return f"This example shows how to use the word '{word}' in context."

df["example_en"] = df["word"].apply(generate_example)
df["example_ko"] = "이 문장은 단어 사용 예시이다."

# 6. 저장
df.to_csv("vocab_final_enriched.csv", index=False)