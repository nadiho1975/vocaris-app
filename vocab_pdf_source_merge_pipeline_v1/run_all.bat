@echo off
chcp 65001 > nul
python vocab_pdf_source_merge.py --input app_vocab_master_rebuilt_examples_all_v19.csv --eowhi-pdf "어휘끝 수능.pdf" --neung-pdf "2022 능률VOCA 고교필수 2000.pdf" --output app_vocab_pdf_sourced_final.csv --audit app_vocab_pdf_sourced_final.audit.csv --missing app_vocab_pdf_sourced_final.missing.csv --report app_vocab_pdf_sourced_final.report.json --missing-policy clear
pause
