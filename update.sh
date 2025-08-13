#!/bin/bash
DATADIR=/home/jules/Projects/maploaders/EPCloader/data
UPRN_LOOKUP='/mnt/www/stringerhj.co.uk/mapdata/uprn/uprn_lookup.json'
node ./scripts/fetch_data.js district='E07000045'
node ./scripts/summarise_area.js datadir="${DATADIR}" code_name='PARISH_CODE' uprn_lookup="${UPRN_LOOKUP}"