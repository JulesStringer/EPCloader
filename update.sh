#!/bin/bash
DATADIR=/home/jules/Projects/maploaders/EPCloader/data
# lookup table for areas (parish, ward) from UPRN
UPRN_LOOKUP='/mnt/www/stringerhj.co.uk/mapdata/uprn/uprn_lookup.json'
# refresh epc data for district
node ./scripts/fetch_data.js district='E07000045'
# directory for summaries
SUMMARY_DIR=/home/jules/Projects/maploaders/EPCloader/summaries/
# map layers file to merge results with
LAYERS='/mnt/www/stringerhj.co.uk/mapdata/layers.json'
# summary epcs by parish
JSON_OUTPUT="${SUMMARY_DIR}/summary_by_parish.json"
XLSX_OUTPUT="${SUMMARY_DIR}/summary_by_parish.xlsx"
MAP_OUTPUT="parish_EPC"
node ./scripts/summarise_area.js datadir="${DATADIR}" code_name='PARISH_CODE' uprn_lookup="${UPRN_LOOKUP}" json_output="${JSON_OUTPUT}" xlsx_output="${XLSX_OUTPUT}" layers="${LAYERS}" map_output="${MAP_OUTPUT}"
# summary epcs by ward
JSON_OUTPUT="${SUMMARY_DIR}/summary_by_ward.json"
XLSX_OUTPUT="${SUMMARY_DIR}/summary_by_ward.xlsx"
MAP_OUTPUT="ward_EPC"
node ./scripts/summarise_area.js datadir="${DATADIR}" code_name='WARD_CODE' uprn_lookup="${UPRN_LOOKUP}" json_output="${JSON_OUTPUT}" xlsx_output="${XLSX_OUTPUT}" layers="${LAYERS}" map_output="${MAP_OUTPUT}"
