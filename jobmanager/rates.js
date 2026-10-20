/* APS Job Manager — Quote Finale rate book 2026-10-12 (already 10% off).
   Labour lines copied from quote-app. Crew day, crew hour and the all-in
   bathroom point are the published rate card (they are not single catalogue rows).
   No VAT. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.APSRates = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var JOBS = [{"c":"Taps & mixers","j":"Replace washer / O-ring / cartridge (accessible)","l":585,"co":"Yes"},{"c":"Taps & mixers","j":"Replace basin mixer","l":680,"co":"Yes"},{"c":"Taps & mixers","j":"Replace kitchen mixer (standard deck)","l":585,"co":"Yes"},{"c":"Taps & mixers","j":"Replace bath mixer / shower mixer (exposed)","l":680,"co":"Yes"},{"c":"Taps & mixers","j":"Replace concealed shower mixer / flush plate","l":1620,"co":"Yes"},{"c":"Taps & mixers","j":"Replace pair of pillar taps","l":585,"co":"Yes"},{"c":"Taps & mixers","j":"Fit / replace angle regulating valves (pair)","l":585,"co":"Yes"},{"c":"Taps & mixers","j":"Replace wall-mounted kitchen / sink mixer","l":720,"co":"Yes"},{"c":"Taps & mixers","j":"Fit / replace pull-out or spray kitchen mixer","l":585,"co":"Yes"},{"c":"Taps & mixers","j":"Replace bath/shower diverter","l":585,"co":"Yes"},{"c":"Taps & mixers","j":"Re-seat / re-washer tap seat","l":585,"co":"Yes"},{"c":"Taps & mixers","j":"Fit sensor / push (self-closing) tap","l":1040,"co":"No"},{"c":"Taps & mixers","j":"Replace shower rose / hand shower & hose","l":585,"co":"Yes"},{"c":"Taps & mixers","j":"Fit rain shower head with wall arm","l":720,"co":"No"},{"c":"Taps & mixers","j":"Replace stop tap / bib tap in laundry or garage","l":585,"co":"Yes"},{"c":"Taps & mixers","j":"Fit boiling / filtered water tap (under-sink unit)","l":1490,"co":"No"},{"c":"Toilet & cistern","j":"Replace top-flush cistern mechanism (universal)","l":585,"co":"Yes"},{"c":"Toilet & cistern","j":"Replace side-flush / cable flush mechanism","l":585,"co":"Yes"},{"c":"Toilet & cistern","j":"Replace fill valve only","l":585,"co":"Yes"},{"c":"Toilet & cistern","j":"Replace flush valve / siphon only","l":585,"co":"Yes"},{"c":"Toilet & cistern","j":"Replace close-coupled cistern (pan remains)","l":900,"co":"Yes"},{"c":"Toilet & cistern","j":"Replace close-coupled toilet suite (pan + cistern)","l":1350,"co":"Yes"},{"c":"Toilet & cistern","j":"Replace toilet seat","l":585,"co":"Yes"},{"c":"Toilet & cistern","j":"Clear blocked toilet (auger / plunger)","l":585,"co":"Yes"},{"c":"Toilet & cistern","j":"Repair running / leaking cistern (adjust & reseal)","l":585,"co":"Yes"},{"c":"Toilet & cistern","j":"Replace cistern inlet / flexi and stop valve","l":585,"co":"Yes"},{"c":"Toilet & cistern","j":"Re-seat / re-seal loose toilet pan","l":585,"co":"Yes"},{"c":"Toilet & cistern","j":"Replace dual-flush button / push mechanism","l":585,"co":"Yes"},{"c":"Toilet & cistern","j":"Replace concealed cistern internals (via flush plate)","l":720,"co":"Yes"},{"c":"Toilet & cistern","j":"Replace low-level / high-level cistern & flush pipe","l":1170,"co":"Yes"},{"c":"Toilet & cistern","j":"Install new toilet (new position, incl. waste & supply)","l":1530,"co":"No"},{"c":"Toilet & cistern","j":"Fit back-to-wall / rimless toilet (existing point)","l":1760,"co":"No"},{"c":"Toilet & cistern","j":"Remove toilet blockage by lifting pan","l":1170,"co":"Yes"},{"c":"Basin & sanitary","j":"Replace basin (pedestal) labour","l":1170,"co":"Yes"},{"c":"Basin & sanitary","j":"Replace wall-hung basin","l":1310,"co":"Yes"},{"c":"Basin & sanitary","j":"Remove and refit wall-hung basin (existing pipework), incl. new angle valves and trap fitting","l":1310,"co":"Yes"},{"c":"Basin & sanitary","j":"Replace bath (acrylic, straightforward)","l":2660,"co":"Yes"},{"c":"Basin & sanitary","j":"Replace shower tray","l":2070,"co":"Yes"},{"c":"Basin & sanitary","j":"Fit bidet / urinal (domestic)","l":1170,"co":"Yes"},{"c":"Basin & sanitary","j":"Install drop-in / vanity basin with mixer, waste & trap (new)","l":1760,"co":"No"},{"c":"Basin & sanitary","j":"Install kitchen sink (new) with mixer & waste","l":1760,"co":"No"},{"c":"Basin & sanitary","j":"Install shower (new) — mixer, rose, waste (first + second fix)","l":1530,"co":"No"},{"c":"Basin & sanitary","j":"Install bath (new) — supply, waste & mixer","l":1530,"co":"No"},{"c":"Basin & sanitary","j":"Fit wall-hung toilet with concealed cistern frame","l":2880,"co":"No"},{"c":"Basin & sanitary","j":"Reseal basin / vanity (silicone)","l":585,"co":"Yes"},{"c":"Basin & sanitary","j":"Fit vanity cabinet + basin (existing points)","l":1760,"co":"No"},{"c":"Basin & sanitary","j":"Fit double vanity (2 basins, existing points)","l":2660,"co":"No"},{"c":"Basin & sanitary","j":"Strip out one fixture (basin / toilet / bath / shower), cap off","l":270,"co":"No"},{"c":"Basin & sanitary","j":"Install bidet with mixer (new point)","l":1530,"co":"No"},{"c":"Basin & sanitary","j":"Replace toilet suite + basin (existing points, new angle valves & flexis)","l":2570,"co":"No"},{"c":"Showers & baths","j":"Reseal bath / shower tray (silicone)","l":585,"co":"Yes"},{"c":"Showers & baths","j":"Fit freestanding bath with floor waste (points exist)","l":2700,"co":"No"},{"c":"Showers & baths","j":"Fit freestanding floor-mounted bath mixer","l":1490,"co":"No"},{"c":"Showers & baths","j":"Install walk-in shower drain / linear channel drain","l":2700,"co":"No"},{"c":"Showers & baths","j":"Install concealed shower mixer (new, first fix)","l":2070,"co":"No"},{"c":"Showers & baths","j":"Convert bath to shower (plumbing labour only)","l":1800,"co":"No"},{"c":"Showers & baths","j":"Fix leaking shower (find & repair behind tiles, no tiling)","l":2070,"co":"Yes"},{"c":"Showers & baths","j":"Fit electric / instant shower heater","l":1490,"co":"No"},{"c":"Kitchens","j":"Replace kitchen sink (existing points)","l":1170,"co":"Yes"},{"c":"Kitchens","j":"Fit double-bowl sink waste & trap kit","l":585,"co":"Yes"},{"c":"Kitchens","j":"Install waste disposal unit (sink garbage disposer)","l":1490,"co":"No"},{"c":"Kitchens","j":"Move kitchen sink to new position (supply + waste, ≤3 m)","l":3510,"co":"No"},{"c":"Kitchens","j":"Kitchen plumbing first + second fix (full kitchen)","l":4860,"co":"No"},{"c":"Kitchens","j":"Install under-counter / reverse-osmosis water filter","l":1490,"co":"No"},{"c":"Appliances","j":"Connect washing machine / dishwasher (point exists)","l":585,"co":"Yes"},{"c":"Appliances","j":"New washing machine / dishwasher point (supply + waste)","l":1890,"co":"No"},{"c":"Appliances","j":"Fit fridge water line / under-sink filter","l":585,"co":"Yes"},{"c":"Appliances","j":"Replace washing machine stop tap / hose","l":585,"co":"Yes"},{"c":"Appliances","j":"Fit ice-maker / fridge water connection (new line ≤5 m)","l":1490,"co":"No"},{"c":"Appliances","j":"Install water softener (labour)","l":2070,"co":"No"},{"c":"Appliances","j":"Connect coffee machine / water dispenser (commercial-grade)","l":720,"co":"No"},{"c":"Drains & waste","j":"Unblock basin / sink / bath (hand tools)","l":585,"co":"Yes"},{"c":"Drains & waste","j":"Unblock shower P-trap / gully","l":585,"co":"Yes"},{"c":"Drains & waste","j":"Unblock kitchen grease blockage","l":900,"co":"Yes"},{"c":"Drains & waste","j":"Rod branch line to gully","l":900,"co":"Yes"},{"c":"Drains & waste","j":"Main sewer / stack jetting","l":1310,"co":"Yes"},{"c":"Drains & waste","j":"Drain camera survey (up to 20–30 m)","l":720,"co":"Yes"},{"c":"Drains & waste","j":"Replace bottle trap / link waste","l":585,"co":"Yes"},{"c":"Drains & waste","j":"Replace bath / shower waste & overflow","l":900,"co":"Yes"},{"c":"Drains & waste","j":"Fit / replace non-return valve on waste","l":900,"co":"Yes"},{"c":"Drains & waste","j":"Outside gully rebuild (labour)","l":2070,"co":"Yes"},{"c":"Drains & waste","j":"Septic tank / soakaway connection (labour)","l":4320,"co":"No"},{"c":"Drains & waste","j":"Replace toilet waste / pan connector","l":900,"co":"Yes"},{"c":"Drains & waste","j":"Gully / manhole cover & rodding eye fit","l":585,"co":"Yes"},{"c":"Drains & waste","j":"High-pressure jetting, extra hour on site","l":585,"co":"Yes"},{"c":"Drains & waste","j":"Clear blocked stormwater drain / channel","l":900,"co":"Yes"},{"c":"Drains & waste","j":"Clear root intrusion (cutter head)","l":1170,"co":"Yes"},{"c":"Drains & waste","j":"Locate / trace sewer line with sonde","l":585,"co":"Yes"},{"c":"Drains & waste","j":"Raise / rebuild manhole (labour, brick)","l":3240,"co":"Yes"},{"c":"Drains & waste","j":"Sewer pipe repair, 110 mm uPVC (per metre, excl. digging)","l":720,"co":"Yes"},{"c":"Drains & waste","j":"Replace broken clay sewer section with uPVC (up to 2 m, excl. digging)","l":1760,"co":"Yes"},{"c":"Drains & waste","j":"Replace 50 mm waste pipe run (per metre)","l":360,"co":"Yes"},{"c":"Drains & waste","j":"Fit air-admittance valve (vent valve)","l":585,"co":"Yes"},{"c":"Drains & waste","j":"Replace soil stack / vent pipe section (up to 3 m)","l":2070,"co":"Yes"},{"c":"Drains & waste","j":"Replace PVC gutter downpipe shoe / gully grid","l":585,"co":"Yes"},{"c":"Drains & waste","j":"Install new gully with trap (labour, excl. digging)","l":2070,"co":"No"},{"c":"Hot water / geyser","j":"Replace geyser element (access OK)","l":900,"co":"Yes"},{"c":"Hot water / geyser","j":"Replace thermostat","l":585,"co":"Yes"},{"c":"Hot water / geyser","j":"Replace TP / safety valve","l":585,"co":"Yes"},{"c":"Hot water / geyser","j":"Replace PRV / pressure control valve","l":900,"co":"Yes"},{"c":"Hot water / geyser","j":"Replace vacuum breakers (pair)","l":585,"co":"Yes"},{"c":"Hot water / geyser","j":"Replace drip tray","l":900,"co":"Yes"},{"c":"Hot water / geyser","j":"Full geyser replacement 100–150L (labour only)","l":2930,"co":"No"},{"c":"Hot water / geyser","j":"Full geyser replacement 200L+ / awkward loft","l":3780,"co":"No"},{"c":"Hot water / geyser","j":"Solar geyser / heat pump changeover labour","l":4320,"co":"No"},{"c":"Hot water / geyser","j":"Same-day burst geyser make-safe","l":900,"co":"Yes (after-hours)"},{"c":"Hot water / geyser","j":"Geyser timer / geyser blanket fit","l":585,"co":"Yes"},{"c":"Hot water / geyser","j":"Replace anode","l":900,"co":"Yes"},{"c":"Hot water / geyser","j":"Replace thermostatic mixing valve (TMV)","l":900,"co":"Yes"},{"c":"Hot water / geyser","j":"Move geyser from ceiling to outside / new position","l":5400,"co":"No"},{"c":"Hot water / geyser","j":"Heat pump install (new, labour)","l":3780,"co":"No"},{"c":"Hot water / geyser","j":"Geyser repair: fault finding / diagnosis","l":585,"co":"Yes"},{"c":"Hot water / geyser","j":"Replace geyser isolator / stopcock","l":585,"co":"Yes"},{"c":"Hot water / geyser","j":"Replace geyser overflow / drain pipe","l":720,"co":"Yes"},{"c":"Hot water / geyser","j":"Replace geyser element + thermostat together","l":900,"co":"Yes"},{"c":"Hot water / geyser","j":"Full geyser replacement 50–100L (labour only)","l":2570,"co":"No"},{"c":"Hot water / geyser","j":"Full geyser replacement 250–300L (labour only)","l":4320,"co":"No"},{"c":"Hot water / geyser","j":"Horizontal ↔ vertical geyser swap (labour only)","l":3780,"co":"No"},{"c":"Hot water / geyser","j":"Install geyser drip tray & overflow (new, no tray before)","l":1350,"co":"No"},{"c":"Hot water / geyser","j":"Fit geyser solar-PV / smart controller (plumbing side only)","l":720,"co":"No"},{"c":"Hot water / geyser","j":"Insurance geyser report (burst geyser claim)","l":585,"co":"No"},{"c":"Hot water / geyser","j":"Ceiling access: open & make good trap door to geyser","l":1040,"co":"No"},{"c":"Hot water / geyser","j":"Geyser plumbing CoC (add-on, if not included in geyser swap)","l":765,"co":"No"},{"c":"Solar & heat pump","j":"Install solar geyser — direct / close-coupled system (labour)","l":4860,"co":"No"},{"c":"Solar & heat pump","j":"Install solar geyser — indirect / split system (labour)","l":6480,"co":"No"},{"c":"Solar & heat pump","j":"Retrofit solar panels to existing geyser (labour)","l":3780,"co":"No"},{"c":"Solar & heat pump","j":"Replace solar circulation pump","l":900,"co":"Yes"},{"c":"Solar & heat pump","j":"Replace solar controller / sensor","l":585,"co":"Yes"},{"c":"Solar & heat pump","j":"Replace evacuated tubes (per 5 tubes)","l":585,"co":"Yes"},{"c":"Solar & heat pump","j":"Solar / heat pump service (flush, check, report)","l":900,"co":"Yes"},{"c":"Solar & heat pump","j":"Heat pump service / fault visit","l":720,"co":"Yes"},{"c":"Gas (if qualified)","j":"Hotplate / hob flexible connect (LPG) labour","l":585,"co":"Yes"},{"c":"Gas (if qualified)","j":"Gas geyser / water heater labour install","l":2340,"co":"No"},{"c":"Gas (if qualified)","j":"Gas instant water heater replace (like-for-like)","l":1490,"co":"Yes"},{"c":"Gas (if qualified)","j":"Gas pipe run copper (per metre)","l":360,"co":"No"},{"c":"Gas (if qualified)","j":"LPG cylinder changeover / regulator replace","l":585,"co":"Yes"},{"c":"Gas (if qualified)","j":"Gas leak test & certificate of conformity (plumbing side)","l":1040,"co":"No"},{"c":"Pipework & leaks","j":"Repair visible copper joint / remake solder joint","l":585,"co":"Yes"},{"c":"Pipework & leaks","j":"Repair / remake PEX crimp joint","l":585,"co":"Yes"},{"c":"Pipework & leaks","j":"Cut in isolation valve on 15/22 mm copper","l":900,"co":"Yes"},{"c":"Pipework & leaks","j":"Replace short run 15 mm copper (≤3 m) labour","l":1170,"co":"Yes"},{"c":"Pipework & leaks","j":"Replace short run 22 mm copper labour","l":1490,"co":"Yes"},{"c":"Pipework & leaks","j":"Convert short section copper → PEX labour","l":1170,"co":"Yes"},{"c":"Pipework & leaks","j":"Under-sink flexible connector replacement (pair)","l":585,"co":"Yes"},{"c":"Pipework & leaks","j":"Chase wall for new pipe (labour only, per metre)","l":500,"co":"Yes"},{"c":"Pipework & leaks","j":"Under-tile leak: open, repair, close (no tiling)","l":2070,"co":"Yes"},{"c":"Pipework & leaks","j":"Slab leak investigation (first visit)","l":1170,"co":"Yes"},{"c":"Pipework & leaks","j":"Acoustic / thermal leak detection visit","l":900,"co":"Yes"},{"c":"Pipework & leaks","j":"Burst pipe repair (accessible)","l":1040,"co":"Yes"},{"c":"Pipework & leaks","j":"Re-pipe house in PEX (per point / run)","l":900,"co":"No"},{"c":"Pipework & leaks","j":"Copper pipe run 15 mm, new (per metre, surface)","l":230,"co":"No"},{"c":"Pipework & leaks","j":"Copper pipe run 22 mm, new (per metre, surface)","l":320,"co":"No"},{"c":"Pipework & leaks","j":"PEX / multilayer pipe run, new (per metre)","l":180,"co":"No"},{"c":"Pipework & leaks","j":"HDPE supply line (per metre, excl. digging)","l":180,"co":"No"},{"c":"Pipework & leaks","j":"Repair galvanised pipe leak (cut out, couple to copper/PEX)","l":1170,"co":"Yes"},{"c":"Pipework & leaks","j":"Replace galvanised section with copper/PEX (up to 6 m)","l":2660,"co":"Yes"},{"c":"Pipework & leaks","j":"Re-pipe whole house hot & cold (small house, labour)","l":15120,"co":"No"},{"c":"Pipework & leaks","j":"Lag / insulate hot water pipes (per 10 m)","l":720,"co":"No"},{"c":"Pipework & leaks","j":"Fix water hammer (arrestor / clip pipes)","l":900,"co":"Yes"},{"c":"Pipework & leaks","j":"Leak repair in ceiling (accessible, excl. ceiling repair)","l":900,"co":"Yes"},{"c":"Pipework & leaks","j":"Underground leak: dig, repair, backfill (up to 1 m deep)","l":2660,"co":"Yes"},{"c":"Pipework & leaks","j":"Reroute pipe out of slab into wall / ceiling (per point)","l":2660,"co":"Yes"},{"c":"Water supply","j":"Replace garden tap / bibcock","l":585,"co":"Yes"},{"c":"Water supply","j":"Fit / replace pressure reducing valve (house)","l":1170,"co":"Yes"},{"c":"Water supply","j":"Fit whole-house filter / strainer labour","l":900,"co":"Yes"},{"c":"Water supply","j":"Replace water meter connection / stopcock (council interface)","l":1490,"co":"Yes"},{"c":"Water supply","j":"Rainwater tank connection to garden line","l":2070,"co":"Yes"},{"c":"Water supply","j":"Whole-house filter + UV install with tie-in (22 mm)","l":3510,"co":"No"},{"c":"Water supply","j":"JoJo / water tank install with connection (no pump)","l":2700,"co":"No"},{"c":"Water supply","j":"Booster pump install / replace","l":2070,"co":"Yes"},{"c":"Water supply","j":"Tank + pump backup water system install","l":9900,"co":"No"},{"c":"Water supply","j":"Borehole pump replace (labour, excl. pulling rig)","l":4410,"co":"Yes"},{"c":"Water supply","j":"Irrigation / garden line run (per 10 m)","l":1040,"co":"No"},{"c":"Water supply","j":"Replace main stopcock (property side)","l":900,"co":"Yes"},{"c":"Water supply","j":"Fit private sub-meter","l":1040,"co":"No"},{"c":"Water supply","j":"Water meter leak test & report (for council dispute)","l":585,"co":"Yes"},{"c":"Water supply","j":"Install new garden tap with new line (≤5 m)","l":1490,"co":"No"},{"c":"Water supply","j":"Low pressure investigation","l":585,"co":"Yes"},{"c":"Water supply","j":"Fit pressure gauge / test house pressure","l":585,"co":"Yes"},{"c":"Water supply","j":"Install drip irrigation zone (per zone)","l":2070,"co":"No"},{"c":"Water supply","j":"Fit irrigation valve / controller (per valve)","l":720,"co":"No"},{"c":"Water supply","j":"Repair irrigation leak / broken sprinkler","l":585,"co":"Yes"},{"c":"Tanks, pumps & boreholes","j":"Build tank stand base connection & overflow (labour)","l":1490,"co":"No"},{"c":"Tanks, pumps & boreholes","j":"Fit float valve / ball valve to tank","l":585,"co":"Yes"},{"c":"Tanks, pumps & boreholes","j":"Fit pressure switch / pressure vessel to pump","l":720,"co":"Yes"},{"c":"Tanks, pumps & boreholes","j":"Fit automatic changeover (municipal ↔ tank) valve","l":1490,"co":"No"},{"c":"Tanks, pumps & boreholes","j":"Pump fault finding / repair visit","l":585,"co":"Yes"},{"c":"Tanks, pumps & boreholes","j":"Borehole tie-in to house / irrigation (labour)","l":3240,"co":"No"},{"c":"Tanks, pumps & boreholes","j":"Clean / flush water tank (up to 5,000 L)","l":1170,"co":"Yes"},{"c":"Tanks, pumps & boreholes","j":"Install sump / submersible drainage pump","l":1490,"co":"No"},{"c":"Tanks, pumps & boreholes","j":"Install pool top-up / auto-fill valve","l":1040,"co":"No"},{"c":"Tanks, pumps & boreholes","j":"Tank + pump backup — basic install (tank, pump, single tie-in)","l":8100,"co":"No"},{"c":"Filtration","j":"Replace filter cartridges (whole-house, per housing)","l":585,"co":"Yes"},{"c":"Filtration","j":"Replace UV lamp / quartz sleeve","l":585,"co":"Yes"},{"c":"Filtration","j":"Install point-of-use filter (single tap)","l":720,"co":"No"},{"c":"Filtration","j":"Annual filtration / UV service","l":585,"co":"Yes"},{"c":"Rainwater & gutters","j":"Fit first-flush diverter / leaf filter to downpipe","l":720,"co":"No"},{"c":"Rainwater & gutters","j":"Connect downpipe to rainwater tank (per downpipe)","l":1040,"co":"No"},{"c":"Rainwater & gutters","j":"Replace downpipe (per storey, PVC)","l":585,"co":"Yes"},{"c":"Rainwater & gutters","j":"Clear / flush gutters & downpipes (single-storey house)","l":1170,"co":"Yes"},{"c":"New installations","j":"Bathroom plumbing first fix (per point)","l":900,"co":"No"},{"c":"New installations","j":"Bathroom plumbing second fix (per fitting)","l":630,"co":"No"},{"c":"New installations","j":"Full bathroom plumbing (rip-out & redo, labour)","l":5400,"co":"No"},{"c":"New installations","j":"New house / extension water reticulation (per point)","l":900,"co":"No"},{"c":"New installations","j":"New sewer / drain line uPVC 110 mm (per metre, excl. digging)","l":500,"co":"No"},{"c":"New installations","j":"Pressure test new installation + report","l":720,"co":"No"},{"c":"New installations","j":"Bathroom first fix — complete bathroom (basin, toilet, shower/bath)","l":2700,"co":"No"},{"c":"New installations","j":"Bathroom second fix — complete bathroom (fit 3–4 fixtures)","l":1890,"co":"No"},{"c":"New installations","j":"Full bathroom refurb plumbing — per bathroom (strip, first & second fix)","l":5400,"co":"No"},{"c":"New installations","j":"Guest toilet / cloakroom (toilet + basin) — full plumbing","l":3060,"co":"No"},{"c":"New installations","j":"Laundry plumbing (tub + machine point)","l":2660,"co":"No"},{"c":"New installations","j":"Outside braai / scullery sink point","l":2660,"co":"No"},{"c":"New installations","j":"Granny flat / cottage plumbing (1 bath + kitchenette, labour)","l":15120,"co":"No"},{"c":"New installations","j":"Connect new building to municipal sewer (excl. digging)","l":3240,"co":"No"},{"c":"Commercial","j":"Replace urinal flush valve / sensor","l":720,"co":"Yes"},{"c":"Commercial","j":"Install waterless / standard urinal (existing point)","l":1490,"co":"No"},{"c":"Commercial","j":"Replace commercial flush valve (Geberit / Cobra type)","l":720,"co":"Yes"},{"c":"Commercial","j":"Install grease trap (under-sink, labour)","l":2070,"co":"No"},{"c":"Commercial","j":"Pump out / clean small grease trap (no tanker)","l":900,"co":"Yes"},{"c":"Commercial","j":"Install commercial pre-rinse spray / pot filler","l":1490,"co":"No"},{"c":"Commercial","j":"Restaurant / office planned maintenance visit (per hour)","l":585,"co":"No"},{"c":"Commercial","j":"Install backflow preventer / double check valve","l":1490,"co":"No"},{"c":"Compliance","j":"Plumbing COC inspection + certificate (simple house)","l":1170,"co":"No"},{"c":"Compliance","j":"COC — complex / multi-bathroom","l":1890,"co":"No"},{"c":"Compliance","j":"Pre-sale snag list / buyer inspection report","l":900,"co":"Yes"},{"c":"Compliance","j":"Municipality / building control query support","l":585,"co":"No"},{"c":"Compliance","j":"Pressure test existing installation + report","l":720,"co":"No"},{"c":"Compliance","j":"Geyser compliance check & certificate (SANS 10254)","l":720,"co":"No"},{"c":"Compliance","j":"Insurance claim plumbing report (leak / damage)","l":1040,"co":"No"},{"c":"Compliance","j":"Water-meter / council leak certificate","l":585,"co":"No"},{"c":"Compliance","j":"Drain / sewer camera report (written, with video)","l":1170,"co":"No"},{"c":"Emergency / after-hours","j":"After-hours emergency attendance (first hour, weekdays)","l":880,"co":"Yes (after-hours)"},{"c":"Emergency / after-hours","j":"Weekend / public holiday emergency (first hour)","l":880,"co":"Yes (after-hours)"},{"c":"Emergency / after-hours","j":"Emergency burst pipe isolate & make safe (after-hours)","l":900,"co":"Yes (after-hours)"},{"c":"Emergency / after-hours","j":"Emergency sewer blockage (after-hours)","l":1080,"co":"Yes (after-hours)"},{"c":"Emergency / after-hours","j":"Each extra after-hours hour","l":880,"co":"N/A"},{"c":"Add-ons","j":"Core drill hole through wall (per hole, up to 110 mm)","l":450,"co":"No"},{"c":"Add-ons","j":"Chase & make good for pipe (per metre, no plaster finish)","l":360,"co":"No"},{"c":"Add-ons","j":"Fit access hatch / inspection panel","l":720,"co":"No"},{"c":"Add-ons","j":"Rubble / old fixture disposal (per load, bakkie)","l":585,"co":"No"},{"c":"Add-ons","j":"Old geyser removal & disposal","l":585,"co":"No"},{"c":"Add-ons","j":"Travel outside Zone A (per extra 10 km, flat)","l":585,"co":"N/A"},{"c":"Add-ons","j":"Waiting / standing time (per hour)","l":585,"co":"N/A"},{"c":"Add-ons","j":"Collect materials from Plumblink (per trip)","l":500,"co":"N/A"},{"c":"Maintenance","j":"Annual plumbing health check (house)","l":1040,"co":"No"},{"c":"Maintenance","j":"Estate / complex planned maintenance (per unit visit)","l":585,"co":"No"},{"c":"Maintenance","j":"Descale geyser / flush vessel labour","l":1170,"co":"Yes"},{"c":"Maintenance","j":"Free geyser inspection (visit, if offered)","l":0,"co":"No (free)"},{"c":"Maintenance","j":"Landlord / agency pre-tenant plumbing check","l":585,"co":"Yes"},{"c":"Maintenance","j":"Complex / body-corporate common-area inspection (per block)","l":1490,"co":"No"},{"c":"Maintenance","j":"Guest house / B&B plumbing service (per room)","l":360,"co":"No"},{"c":"Maintenance","j":"Geyser service (drain, anode check, valves)","l":900,"co":"Yes"},{"c":"Maintenance","j":"Move-out / end-of-lease plumbing repair list (per hour)","l":585,"co":"Yes"}];
  var RATES = {
    book: '2026-10-12',
    hourly: 585,
    callout: 585,
    ahHourly: 880,
    ahMin: 1080,
    crewDay: 4320,
    crewHour: 540,
    point: 1800,
    pointParts: {strip: 270, first: 900, second: 630},
    coc: 765,
    deposit: 0.8,
    consumables: 0.05,
    markup: {high: {e: 25, p: 35, f: 45}, low: {e: 20, p: 30, f: 40}}
  };
  var EXTRAS = [
    {c: 'Rates', j: 'Repair / fault-finding labour (per hour)', l: RATES.hourly, co: 'Yes'},
    {c: 'Rates', j: 'Crew day (plumber and assistant)', l: RATES.crewDay, co: 'No'},
    {c: 'Rates', j: 'Crew part-day (per hour)', l: RATES.crewHour, co: 'No'},
    {c: 'Rates', j: 'Bathroom point (strip-out, first fix and second fix)', l: RATES.point, co: 'No'}
  ];
  var CATALOGUE = EXTRAS.concat(JOBS);
  var BYNAME = {};
  CATALOGUE.forEach(function (j) { BYNAME[j.j] = j; });
  var QUICK = [
    ['Hourly', 'Repair / fault-finding labour (per hour)'],
    ['Crew day', 'Crew day (plumber and assistant)'],
    ['Crew hour', 'Crew part-day (per hour)'],
    ['Per point', 'Bathroom point (strip-out, first fix and second fix)'],
    ['CoC', 'Geyser plumbing CoC (add-on, if not included in geyser swap)'],
    ['After-hours', 'After-hours emergency attendance (first hour, weekdays)'],
    ['150 L geyser', 'Full geyser replacement 100–150L (labour only)'],
    ['Small repair', 'Replace washer / O-ring / cartridge (accessible)']
  ];

  function r2(n) { return Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100; }
  function money(n) {
    var v = r2(n);
    var sign = v < 0 ? '-' : '';
    return 'R ' + sign + Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function coKind(flag) {
    var s = String(flag == null ? '' : flag).trim();
    if (/^yes\s*\(after-hours\)/i.test(s)) return 'ah';
    if (/^yes\b/i.test(s)) return 'yes';
    return 'no';
  }
  function labourGeneric(n) {
    var s = String(n == null ? '' : n);
    if (s.indexOf('Remove and refit wall-hung basin') === 0) return 'Remove and refit wall-hung basin, incl. new angle valves and trap fitting';
    return s.replace(/\s*\(.*$/, '').trim();
  }
  function callout(items) {
    var ah = false, yes = false;
    (items || []).forEach(function (i) {
      if ((+i.qty || 0) <= 0 || i.kind === 'material') return;
      var k = coKind(i.co);
      if (k === 'ah') ah = true;
      else if (k === 'yes') yes = true;
    });
    if (ah) return RATES.ahMin;
    if (yes) return RATES.callout;
    return 0;
  }
  function totals(q) {
    q = q || {};
    var labour = 0, matLines = 0;
    (q.items || []).forEach(function (i) {
      var qty = +i.qty || 0;
      if (qty <= 0) return;
      var line = (+i.each || 0) * qty;
      if (i.kind === 'material') matLines += line;
      else labour += line;
    });
    var co = (q.callout_lock != null && q.callout_lock !== '') ? r2(+q.callout_lock || 0) : callout(q.items);
    var ah = q.ah ? r2(labour * 0.5) : 0;
    var discPct = Math.min(100, Math.max(0, +q.disc || 0));
    var disc = discPct ? -r2((labour + ah) * discPct / 100) : 0;
    var mat = r2(matLines + (+q.mat_typed || 0));
    var cons = q.cons === false ? 0 : r2(mat * RATES.consumables);
    var total = r2(labour + co + ah + disc + mat + cons);
    var dep = r2(total * RATES.deposit);
    return {
      labour: r2(labour), co: co, ah: ah, disc: disc, mat: mat, cons: cons,
      total: total, dep: dep, bal: r2(total - dep), labourAll: r2(labour + co + ah + disc)
    };
  }
  function markupPct(cls, tier) {
    var t = tier === 'low' ? RATES.markup.low : RATES.markup.high;
    var k = cls === 'e' || cls === 'p' ? cls : 'f';
    return t[k];
  }
  function sell(cost, cls, tier) { return r2((Number(cost) || 0) * (1 + markupPct(cls, tier) / 100)); }
  function scopeLines(q) {
    var lines = [];
    (q.items || []).forEach(function (i) {
      if ((+i.qty || 0) <= 0) return;
      var name = i.kind === 'material' ? (i.generic || i.name || 'Material') : labourGeneric(i.name);
      var qty = +i.qty;
      lines.push((qty === 1 ? '1' : String(qty)) + ' × ' + name);
    });
    return lines;
  }
  function labourLabel(t) {
    if (t.co === RATES.ahMin) return 'Labour (incl. after-hours call-out)';
    if (t.co) return 'Labour (incl. call-out)';
    return 'Labour';
  }

  var TYPES = [
  [/EARTH(ING)?\b.*BOND|BONDING KIT/, "earth bonding kit"],
  [/\bFLUE\b/, "flue kit"],
  [/TUBE STRAP|HOLDERBAT|SADDLE|PIPE CLIP|\bCLIP\b/, "pipe clip"],
  [/FLUX/, "soldering flux"],
  [/LAGGING|INSULATION/, "pipe lagging"],
  [/TOWEL RAIL|TOWEL RING|ROLL HOLDER|ROBE HOOK|SOAP (DISH|HOLDER)|TOWEL BAR/, "bathroom accessory"],
  [/WATER METER/, "water meter"],
  [/GRATE|GULLY|MANHOLE|RODDING/, "drain fitting"],
  [/SUCTION HOSE/, "pump suction hose kit"],
  [/PUMP COVER|PUMP HOUSING/, "pump cover"],
  [/PRESSURE (SWITCH|CONTROL(LER)?\b(?!.*VALVE))|FLOW CONTROL/, "pump pressure controller"],
  [/HEAT PUMP/, "heat pump"],
  [/SOLAR/, null, function (n) { return /GEYSER|CYLINDER/.test(n) ? "solar geyser" : null; }],
  [/GAS GEYSER|GAS WATER HEATER/, "gas water heater"],
  [/INSTANT WATER HEATER|INSTANTANEOUS/, "instant water heater"],
  [/DRIP TRAY OUTLET|TRAY OUTLET|DRT-FITT/, "drip tray outlet"],
  [/TRAY/, "geyser drip tray"],
  [/VACUUM (BREAKER|RELIEF)/, "vacuum breaker"],
  [/PCV|PRESSURE CONTROL|MULTI ?VALVE/, "pressure control valve"],
  [/PRESSURE REDUC|\bPRV\b/, "pressure reducing valve"],
  [/SAFETY VALVE|T ?& ?P VALVE|\bTP VALVE/, "safety valve"],
  [/DRAIN ?COCK/, "drain cock"],
  [/THERMOSTAT/, "geyser thermostat"],
  [/ELEMENT/, "geyser element"],
  [/ANODE/, "anode"],
  [/BLANKET/, "geyser blanket"],
  [/GEYSER/, null, function (n) { return /\d\s*L(T|ITRE)?\b/.test(n) && !/VALVE|KIT|TIMER/.test(n) ? "geyser" : null; }],
  [/SEPTIC/, "septic tank"],
  [/TANK/, null, function (n) { return /\d\s*L/.test(n) ? "water tank" : null; }],
  [/SUMP PUMP|DEWATERING/, "sump pump"],
  [/BOOSTER PUMP|CENTRIFUGAL PUMP/, "booster pump"],
  [/MACERATOR|GREY WATER PUMP|BLACK WATER PUMP/, "macerator pump"],
  [/CIRCULATING PUMP/, "circulating pump"],
  [/PUMP/, "pump"],
  [/FLOAT/, "float valve"],
  [/FILTER BRACKET/, "filter bracket"],
  [/BALL ?VALVE|BALL ?STOP|LEVER VALVE/, "ball valve"],
  [/GATE VALVE/, "gate valve"],
  [/NON[- ]?RETURN|CHECK VALVE/, "non-return valve"],
  [/ANGLE (REGULATING )?VALVE|ANGLE STOP/, "angle valve"],
  [/STOP ?COCK|STOP TAP/, "stopcock"],
  [/BIB ?COCK|BIB ?TAP|GARDEN TAP/, "garden tap"],
  [/BASIN MIXER/, "basin mixer"],
  [/SINK MIXER|KITCHEN MIXER/, "sink mixer"],
  [/BATH.*MIXER|SHOWER MIXER|BATH ?\/ ?SHOWER/, "bath / shower mixer"],
  [/MIXER/, "mixer"],
  [/\b[PS][- ]?TRAP\b/, "trap"],
  [/FLEXI|BRAIDED/, "flexible connector"],
  [/PAN CONNECTOR/, "pan connector"],
  [/CC SUITE|CLOSE[- ]COUPLE[D]? SUITE|TOILET SUITE|PAN & CIST/, "toilet suite"],
  [/TOILET SEAT|\bSEAT\b/, "toilet seat"],
  [/MECHANISM/, "cistern mechanism"],
  [/FILL VALVE|INLET VALVE/, "cistern fill valve"],
  [/CISTERN/, "cistern"],
  [/BASIN WASTE|CLICK.*WASTE|POP[- ]?UP/, "basin waste"],
  [/BOTTLE TRAP/, "bottle trap"],
  [/TRAP/, "trap"],
  [/WASTE/, "waste fitting"],
  [/VANITY/, "vanity unit"],
  [/BASIN/, "basin"],
  [/SINK/, "sink"],
  [/SHOWER (HEAD|ROSE|ARM)/, "shower head"],
  [/FILTER.*CARTRIDGE|CARTRIDGE.*(FILTER|MICRON)/, "filter cartridge"],
  [/CARTRIDGE/, "tap cartridge"],
  [/FILTER/, "filter housing"],
  [/WALL ?PLATE ELBOW/, "wall plate elbow"],
  [/REDUCING (COUPLER|SOCKET)/, "reducing coupler"],
  [/REDUCING BUSH|\bBUSH\b/, "reducing bush"],
  [/REDUC/, "reducer"],
  [/ELBOW/, "elbow"],
  [/BEND/, "bend"],
  [/\bTEE\b/, "tee"],
  [/JUNCTION/, "junction"],
  [/UNION/, "union"],
  [/NIPPLE/, "nipple"],
  [/COUPLER|COUPLING|SOCKET/, "coupler"],
  [/COLLAR|SLEEVE/, "rubber collar"],
  [/HOSE CLAMP|CLAMP/, "hose clamp"],
  [/TUBE STRAP|HOLDERBAT|SADDLE|CLIP|BRACKET/, "pipe clip"],
  [/ADAPTOR|ADAPTER|CONNECTOR/, "adaptor"],
  [/END CAP|STOP END|\bCAP\b|\bPLUG\b/, "end cap"],
  [/HOSE/, "hose"],
  [/THREAD.*TAPE|PTFE/, "thread seal tape"],
  [/SILICONE/, "silicone sealant"],
  [/SOLDER/, "solder"],
  [/CEMENT|SOLVENT/, "pipe cement"],
  [/FLUSH (PLATE|BUTTON|ACTUATOR)|ACTUATOR/, "flush plate"],
  [/\bBATH\b/, "bath"],
  [/SHOWER (DOOR|ENCLOSURE|SCREEN|TRAY)/, "shower enclosure"],
  [/VALVE/, "valve"],
  [/TAP\b/, "tap"],
  [/TUBE|PIPE/, "pipe"],
];
function fmtNum(s) { var n = Number(s); return n >= 1000 ? n.toLocaleString("en-ZA").replace(/\u00a0/g, " ").replace(/ /g, ",") : String(n); }
var NOSIZE = /drip tray|silicone|cement|solder|flux|thread seal tape|earth bonding|pan connector|toilet suite|toilet seat|cistern|^basin$|bath$|accessory|flue kit|lagging|^tap cartridge$/;
function sizeOf(n, type) {
  var m;
  if (NOSIZE.test(type)) return "";
  if (/(^|\s)(geyser|water tank|septic tank|water heater|heat pump)$/.test(type) && (m = /(\d{2,5})\s*L(T|ITRE|TR)?\b/.exec(n))) return fmtNum(m[1]) + " L";
  if (/pump/.test(type) && (m = /(\d+(?:\.\d+)?)\s*KW/.exec(n))) return m[1] + " kW";
  if ((m = /(?<![\d.])(\d{2,3})\s*[xX]\s*(\d{1,3})(?![\d.\/])/.exec(n))) {
    if (/reduc|bush/.test(type) && m[1] !== m[2]) return m[1] + " x " + m[2] + "mm";
    return m[1] + "mm";
  }
  if ((m = /(?<![\d.])(\d{2,3})\s*[xX]\s*[\d.\/]+/.exec(n))) return m[1] + "mm";
  if ((m = /(?<![\d.])(\d{1,3})\s*MM\b/.exec(n))) return m[1] + "mm";
  if ((m = /(?<![\d.\/])(\d\/\d|\d \d\/\d)"/.exec(n))) return m[1] + '"';
  return "";
}
function genericName(name) {
  var n = String(name || "").toUpperCase();
  var type = "";
  for (var i = 0; i < TYPES.length; i++) {
    var t = TYPES[i];
    if (t[0].test(n)) { type = t[2] ? t[2](n) : t[1]; if (type) break; }
  }
  if (!type) return "Plumbing fitting";
  var size = sizeOf(n, type);
  var out = (size ? size + " " : "") + type;
  if (type === "pipe" && /X\s*(\d+(?:\.\d+)?)\s*M\b/.test(n)) out += " (" + /X\s*(\d+(?:\.\d+)?)\s*M\b/.exec(n)[1] + " m length)";
  return out.charAt(0).toUpperCase() + out.slice(1);
}




  var MATERIALS = [
    [/HDPE/, 'HDPE'],
    [/CPVC|UPVC|MPVC|\bPVC\b/, 'PVC'],
    [/PEX[\s-]*AL[\s-]*PEX|MULTILAYER|\bMLP\b|\bMEPLA\b/, 'multilayer'],
    [/\bPEX\b|SPEEDFIT/, 'PEX'],
    [/GALVANI[SZ]ED|\bGALV\b/, 'galvanised'],
    [/STAINLESS|S\/STEEL|S\/S\b/, 'stainless'],
    [/\bBRASS\b|BRASSMAN/, 'brass'],
    [/\bCOPPER\b|COPPERMAN|COPCAL/, 'copper'],
    [/POLYCOP|\bPPR\b|POLYPROP|PP-R|\bPP\b/, 'polypropylene'],
    [/\bABS\b/, 'ABS'],
    [/CAST IRON/, 'cast iron']
  ];
  function firstHit(list, text) {
    for (var i = 0; i < list.length; i++) if (list[i][0].test(text)) return list[i][1];
    return '';
  }
  function materialOf(name, cat) {
    var fromName = firstHit(MATERIALS, String(name || '').toUpperCase());
    if (fromName) return fromName;
    var parts = String(cat || '').toUpperCase().split('>').map(function (s) { return s.trim(); }).filter(function (p) {
      return p && p.indexOf('COPPER ALT') !== 0 && p.indexOf('ALTERNATIVE') !== 0;
    });
    var blob = parts.join(' ');
    if (/GALVANI[SZ]ED|\bGALV\b/.test(blob)) return 'galvanised';
    if (/\bHDPE\b/.test(blob)) return 'HDPE';
    if (/MEPLA|MULTILAYER|\bMLP\b|PEX-AL/.test(blob)) return 'multilayer';
    if (/SPEEDFIT|\bPEX\b/.test(blob)) return 'PEX';
    if (/\bPVC\b/.test(blob)) return 'PVC';
    if (/COPPER/.test(blob)) return 'copper';
    if (/BRASS/.test(blob)) return 'brass';
    if (/STAINLESS|\bSS\b/.test(blob)) return 'stainless';
    if (/POLYPROP|POLYCOP|\bPPR\b|\bPP\b/.test(blob)) return 'polypropylene';
    return '';
  }
  function jointOf(name, cat) {
    var n = String(name || '').toUpperCase();
    var blob = n + ' ' + String(cat || '').toUpperCase();
    if (/COMPRESSION/.test(blob)) return 'compression';
    if (/PUSH[-\s]?FIT|SPEEDFIT|SHARKBITE|JOHN GUEST/.test(blob)) return 'push-fit';
    if (/\bCRIMP/.test(blob)) return 'crimp';
    if (/MAPRESS|\bPRESS\b/.test(blob)) return 'press';
    if (/SOLVENT|FUSION/.test(blob)) return 'solvent';
    if (/CAPILLARY|COPCAL/.test(blob) || (/\bCXC\b/.test(n) && !/COMPRESSION/.test(blob))) return 'capillary/solder';
    if (/THREADED|\bBSP\b|\bFXF\b|\bMXF\b|\bMXM\b|\bCXMI\b|\bCXFI\b|MALE IRON|FEMALE IRON|GROOVED/.test(n)) {
      return /GROOVED/.test(n) ? 'grooved' : 'threaded';
    }
    return '';
  }
  function fittingType(name) {
    var n = String(name || '').toUpperCase();
    var type = '';
    for (var i = 0; i < TYPES.length; i++) {
      var t = TYPES[i];
      if (t[0].test(n)) { type = t[2] ? t[2](n) : t[1]; if (type) break; }
    }
    if (type === 'coupler') return 'coupling';
    if (type === 'reducing coupler') return 'reducing coupling';
    return type || '';
  }
  function fittingAttrs(name, cat) {
    var type = fittingType(name);
    return {
      type: type,
      material: materialOf(name, cat),
      joint: jointOf(name, cat),
      size: sizeOf(String(name || '').toUpperCase(), type)
    };
  }
  function sizeWords(size) {
    var s = String(size || '').toLowerCase();
    if (!/mm|\bx\b|x/.test(s)) return '';
    var out = [];
    s.split(/x/i).forEach(function (part) {
      var n = (part.match(/(\d+(?:\.\d+)?)/) || [])[1];
      if (n) out.push(n + 'mm');
    });
    return out.join(' ');
  }

  function classifier(data) {
    var map = {};
    var cls = (data && data.cls) || {};
    ['e', 'p'].forEach(function (k) { (cls[k] || []).forEach(function (c) { map[c] = k; }); });
    return function (code) { return map[code] || 'f'; };
  }

  return {
    RATES: RATES, JOBS: JOBS, EXTRAS: EXTRAS, CATALOGUE: CATALOGUE, BYNAME: BYNAME, QUICK: QUICK,
    r2: r2, money: money, coKind: coKind, labourGeneric: labourGeneric, callout: callout,
    totals: totals, markupPct: markupPct, sell: sell, scopeLines: scopeLines, labourLabel: labourLabel,
    genericName: genericName, classifier: classifier, fittingAttrs: fittingAttrs, sizeWords: sizeWords
  };
});
