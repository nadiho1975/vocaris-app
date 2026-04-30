@echo off
chcp 65001 > nul


python vocab_pdf_source_merge.py ^
--input app_vocab_master_rebuilt_examples_all_v19.csv ^
--eowhi-pdf eowhi.pdf ^
--neung-pdf neungyul.pdf ^
--output output_all_with_neung.csv ^
--audit output_all_with_neung.audit.csv ^
--missing output_all_with_neung.missing.csv ^
--report output_all_with_neung.report.json ^
--missing-policy keep

pause