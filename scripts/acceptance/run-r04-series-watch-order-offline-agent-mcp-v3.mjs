#!/usr/bin/env node

import { main } from './run-r04-series-watch-order-offline-agent-mcp-v2.mjs';
import { R04_SERIES_WATCH_ORDER_V3_PROFILE_ID } from '../lib/r04-series-watch-order-offline-v3-fixture.mjs';

process.exitCode = main(process.argv.slice(2), R04_SERIES_WATCH_ORDER_V3_PROFILE_ID);
