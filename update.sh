#!/bin/bash
DATADIR=/home/jules/Projects/maploaders/EPCloader/data
UPRN_LOOKUP='/mnt/www/stringerhj.co.uk/mapdata/uprn/uprn_lookup.json'
node ./scripts/fetch_data.js district='E07000045'
JSON_OUTPUT="${DATADIR}/summary_by_parish.json"
XLSX_OUTPUT="${DATADIR}/summary_by_parish.xlsx"
node ./scripts/summarise_area.js datadir="${DATADIR}" code_name='PARISH_CODE' uprn_lookup="${UPRN_LOOKUP}" json_output="${JSON_OUTPUT}" xlsx_output="${XLSX_OUTPUT}" config="${DATADIR}/config.json"
JSON_OUTPUT="${DATADIR}/summary_by_ward.json"
XLSX_OUTPUT="${DATADIR}/summary_by_ward.xlsx"
node ./scripts/summarise_area.js datadir="${DATADIR}" code_name='WARD_CODE' uprn_lookup="${UPRN_LOOKUP}" json_output="${JSON_OUTPUT}" xlsx_output="${XLSX_OUTPUT}" config="${DATADIR}/config.json"
