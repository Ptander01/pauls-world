const fs = require('fs');
const d = JSON.parse(fs.readFileSync('./src/data/pauline-journeys-data.json'));

// Add eraLabels to each journey
const eraLabels = {
  'journey-1': [
    { label: 'COMMISSIONING', startYear: 46, endYear: 47 },
    { label: 'THE RETURN', startYear: 47, endYear: 48 }
  ],
  'journey-2': [
    { label: 'INTO EUROPE', startYear: 49, endYear: 50.5 },
    { label: 'CORINTHIAN MINISTRY', startYear: 50.5, endYear: 52 }
  ],
  'journey-3': [
    { label: 'EPHESUS — THREE YEARS', startYear: 53, endYear: 55.5 },
    { label: 'MACEDONIA & ACHAIA', startYear: 55.5, endYear: 57 }
  ],
  'rome-journey': [
    { label: 'IMPRISONMENT', startYear: 57.3, endYear: 60.2 },
    { label: 'ROME — HOUSE ARREST', startYear: 60.2, endYear: 62 }
  ],
  'post-rome': [
    { label: 'FREEDOM & MINISTRY', startYear: 62, endYear: 64.5 },
    { label: 'FINAL IMPRISONMENT', startYear: 64.5, endYear: 67 }
  ]
};

d.journeys = d.journeys.map(j => ({ ...j, eraLabels: eraLabels[j.id] || [] }));

d.paulEvents = [
  // ── Journey 1 ──────────────────────────────────────────────────────────
  { id: 'j1-commissioned', journeyId: 'journey-1', year: 46, label: 'Commissioned at Antioch', sublabel: 'Set apart by the Holy Spirit', ref: 'Acts 13:2–3', type: 'major' },
  { id: 'j1-bar-jesus', journeyId: 'journey-1', year: 46.2, label: 'Bar-Jesus Blinded', sublabel: 'Sergius Paulus the proconsul believes', ref: 'Acts 13:11–12', type: 'minor' },
  { id: 'j1-antioch-pisidia', journeyId: 'journey-1', year: 46.4, label: 'Great Synagogue Sermon', sublabel: 'Gentiles beg to hear more; expelled by Jews', ref: 'Acts 13:42–50', type: 'major' },
  { id: 'j1-lystra-stoned', journeyId: 'journey-1', year: 46.8, label: 'Stoned at Lystra', sublabel: 'Left for dead; rose and walked back into the city', ref: 'Acts 14:19–20', type: 'arrest' },
  { id: 'j1-derbe-turnaround', journeyId: 'journey-1', year: 47, label: 'Disciples Made at Derbe', sublabel: 'Southernmost point; turned back north', ref: 'Acts 14:21', type: 'minor' },
  { id: 'j1-elders-appointed', journeyId: 'journey-1', year: 47.2, label: 'Elders Appointed', sublabel: 'In every church on the return route', ref: 'Acts 14:23', type: 'minor' },
  { id: 'j1-antioch-report', journeyId: 'journey-1', year: 48, label: 'Reports to Antioch', sublabel: 'God opened a door of faith to the Gentiles', ref: 'Acts 14:27', type: 'major' },

  // ── Journey 2 ──────────────────────────────────────────────────────────
  { id: 'j2-jerusalem-council', journeyId: 'journey-2', year: 49, label: 'Jerusalem Council', sublabel: 'Gentiles need not be circumcised', ref: 'Acts 15:28–29', type: 'major' },
  { id: 'j2-timothy-joins', journeyId: 'journey-2', year: 49.3, label: 'Timothy Joins the Team', sublabel: 'Well spoken of by brothers at Lystra', ref: 'Acts 16:2–3', type: 'minor' },
  { id: 'j2-macedonian-vision', journeyId: 'journey-2', year: 49.7, label: 'Macedonian Vision', sublabel: 'Come over to Macedonia and help us', ref: 'Acts 16:9', type: 'major' },
  { id: 'j2-lydia', journeyId: 'journey-2', year: 49.9, label: 'Lydia Converted', sublabel: 'First European convert; gospel crosses into Europe', ref: 'Acts 16:14–15', type: 'major' },
  { id: 'j2-philippi-prison', journeyId: 'journey-2', year: 49.92, label: 'Imprisoned at Philippi', sublabel: 'Midnight hymns; earthquake; jailer baptized', ref: 'Acts 16:25–34', type: 'arrest' },
  { id: 'j2-thessalonica-riot', journeyId: 'journey-2', year: 50.1, label: 'Riot in Thessalonica', sublabel: 'Men who have turned the world upside down', ref: 'Acts 17:6', type: 'arrest' },
  { id: 'j2-areopagus', journeyId: 'journey-2', year: 50.4, label: 'Areopagus Address', sublabel: 'To an unknown god — a few believe', ref: 'Acts 17:22–34', type: 'major' },
  { id: 'j2-aquila-priscilla', journeyId: 'journey-2', year: 50.5, label: 'Meets Aquila & Priscilla', sublabel: 'Tent-making partnership in Corinth', ref: 'Acts 18:2–3', type: 'minor' },
  { id: 'j2-writes-1thess', journeyId: 'journey-2', year: 51, label: 'Writes 1 Thessalonians', sublabel: 'From Corinth; after Timothy returns with good news', ref: '1 Th 3:6', type: 'writes' },
  { id: 'j2-writes-2thess', journeyId: 'journey-2', year: 51.2, label: 'Writes 2 Thessalonians', sublabel: 'From Corinth; corrects misunderstanding about the Day of the Lord', ref: '2 Th 2:2', type: 'writes' },
  { id: 'j2-gallio', journeyId: 'journey-2', year: 51.5, label: 'Gallio Refuses to Judge', sublabel: 'Legal precedent protects the fledgling mission', ref: 'Acts 18:14–16', type: 'minor' },

  // ── Journey 3 ──────────────────────────────────────────────────────────
  { id: 'j3-hall-of-tyrannus', journeyId: 'journey-3', year: 53.5, label: 'Hall of Tyrannus', sublabel: 'Daily lectures; 2 years; all Asia hears the word', ref: 'Acts 19:9–10', type: 'major' },
  { id: 'j3-miracles', journeyId: 'journey-3', year: 54, label: 'Extraordinary Miracles', sublabel: 'Handkerchiefs heal; books worth 50,000 drachmas burned', ref: 'Acts 19:11–19', type: 'minor' },
  { id: 'j3-writes-1cor', journeyId: 'journey-3', year: 54.5, label: 'Writes 1 Corinthians', sublabel: 'From Ephesus; responding to report from Chloe', ref: '1 Co 1:11; 16:8', type: 'writes' },
  { id: 'j3-riot-artemis', journeyId: 'journey-3', year: 55.2, label: 'Riot of Artemis', sublabel: 'Demetrius the silversmith; theater uproar', ref: 'Acts 19:24–41', type: 'arrest' },
  { id: 'j3-titus-returns', journeyId: 'journey-3', year: 55.6, label: 'Titus Returns with Good News', sublabel: 'Corinthians repented; reconciliation achieved', ref: '2 Co 7:6–7', type: 'minor' },
  { id: 'j3-writes-2cor', journeyId: 'journey-3', year: 55.7, label: 'Writes 2 Corinthians', sublabel: 'From Macedonia; the letter of reconciliation', ref: '2 Co 1:1', type: 'writes' },
  { id: 'j3-writes-romans', journeyId: 'journey-3', year: 56.5, label: 'Writes Romans', sublabel: 'From Corinth; the fullest statement of the gospel', ref: 'Rom 16:1–2', type: 'writes' },
  { id: 'j3-miletus-farewell', journeyId: 'journey-3', year: 56.9, label: 'Farewell to Ephesian Elders', sublabel: 'I do not count my life as precious to myself', ref: 'Acts 20:24', type: 'major' },
  { id: 'j3-agabus', journeyId: 'journey-3', year: 57.2, label: 'Agabus Prophecy', sublabel: 'Bound with his own belt; Paul resolves to press on', ref: 'Acts 21:11', type: 'minor' },
  { id: 'j3-arrested', journeyId: 'journey-3', year: 57.3, label: 'Arrested in Jerusalem', sublabel: 'Temple riot; Claudius Lysias intervenes', ref: 'Acts 21:33', type: 'arrest' },

  // ── Rome Journey ────────────────────────────────────────────────────────
  { id: 'rj-felix-trial', journeyId: 'rome-journey', year: 57.6, label: 'Trial Before Felix', sublabel: 'Felix trembles; waits two years hoping for a bribe', ref: 'Acts 24:25–27', type: 'arrest' },
  { id: 'rj-appeal-caesar', journeyId: 'rome-journey', year: 59.2, label: 'Appeals to Caesar', sublabel: 'You have appealed to Caesar; to Caesar you shall go', ref: 'Acts 25:12', type: 'major' },
  { id: 'rj-before-agrippa', journeyId: 'rome-journey', year: 59.3, label: 'Before King Agrippa', sublabel: 'Almost you persuade me to be a Christian', ref: 'Acts 26:28', type: 'minor' },
  { id: 'rj-shipwreck', journeyId: 'rome-journey', year: 59.8, label: 'Shipwreck at Malta', sublabel: 'Not one of you will lose a hair of his head', ref: 'Acts 27:34', type: 'arrest' },
  { id: 'rj-viper', journeyId: 'rome-journey', year: 59.82, label: 'Survives Viper Bite', sublabel: 'Islanders call him a god; Publius father healed', ref: 'Acts 28:3–9', type: 'minor' },
  { id: 'rj-arrives-rome', journeyId: 'rome-journey', year: 60.2, label: 'Arrives in Rome', sublabel: 'Brothers travel to meet him; Paul gives thanks to God', ref: 'Acts 28:15', type: 'major' },
  { id: 'rj-jewish-leaders', journeyId: 'rome-journey', year: 60.3, label: 'Meets Roman Jewish Leaders', sublabel: 'This sect is spoken against everywhere', ref: 'Acts 28:22', type: 'minor' },
  { id: 'rj-writes-prison', journeyId: 'rome-journey', year: 61, label: 'Writes Prison Epistles', sublabel: 'Philippians · Colossians · Ephesians · Philemon', ref: 'Phil 1:13', type: 'writes' },
  { id: 'rj-released', journeyId: 'rome-journey', year: 62, label: 'Released from Prison', sublabel: 'The Lord stood by me and strengthened me', ref: '2 Ti 4:17', type: 'major' },

  // ── Post-Rome ───────────────────────────────────────────────────────────
  { id: 'pr-leaves-timothy', journeyId: 'post-rome', year: 62.5, label: 'Leaves Timothy in Ephesus', sublabel: 'To charge certain persons not to teach different doctrine', ref: '1 Ti 1:3', type: 'minor' },
  { id: 'pr-writes-1timothy', journeyId: 'post-rome', year: 62.8, label: 'Writes 1 Timothy', sublabel: 'From Macedonia; church order and sound doctrine', ref: '1 Ti 3:14–15', type: 'writes' },
  { id: 'pr-leaves-titus', journeyId: 'post-rome', year: 63, label: 'Leaves Titus in Crete', sublabel: 'To set in order what remains and appoint elders', ref: 'Tit 1:5', type: 'minor' },
  { id: 'pr-writes-titus', journeyId: 'post-rome', year: 63.2, label: 'Writes Titus', sublabel: 'From Nicopolis; urges Titus to come quickly', ref: 'Tit 3:12', type: 'writes' },
  { id: 'pr-second-arrest', journeyId: 'post-rome', year: 64.5, label: 'Second Arrest', sublabel: 'Chained like a criminal; abandoned by many', ref: '2 Ti 1:8; 4:16', type: 'arrest' },
  { id: 'pr-writes-2timothy', journeyId: 'post-rome', year: 66.5, label: 'Writes 2 Timothy', sublabel: 'Final letter; I have finished the race', ref: '2 Ti 4:7', type: 'writes' },
  { id: 'pr-martyrdom', journeyId: 'post-rome', year: 67, label: 'Martyrdom', sublabel: 'Tradition: beheaded on the Ostian Way under Nero', ref: '2 Ti 4:6–8', type: 'major' }
];

// Enrich churchEvents with additional entries
const extraChurchEvents = [
  // Journey 1 — Galatian church foundings
  { id: 'antioch-pisidia-founded', churchId: 'antioch-pisidia', cityId: 'antioch-pisidia', year: 46.4, journeyId: 'journey-1', label: 'Church Founded', sublabel: 'Many Gentiles believed · Acts 13:48', type: 'founding', ref: 'Acts 13:44–49' },
  { id: 'lystra-founded', churchId: 'lystra', cityId: 'lystra', year: 46.8, journeyId: 'journey-1', label: 'Church Founded', sublabel: 'Timothy home church; lame man healed', type: 'founding', ref: 'Acts 14:8–20' },

  // Journey 2
  { id: 'corinth-founded', churchId: 'corinth', cityId: 'corinth', year: 50.5, journeyId: 'journey-2', label: 'Church Founded', sublabel: 'Crispus the synagogue ruler believes · Acts 18:8', type: 'founding', ref: 'Acts 18:1–11' },
  { id: 'phil-gift-corinth', churchId: 'philippi', cityId: 'thessalonica', year: 50.1, journeyId: 'journey-2', label: 'Sends Gift to Paul Again', sublabel: 'Phil. 4:16 — once and again from Thessalonica', type: 'support', ref: 'Philippians 4:16' },

  // Journey 3
  { id: 'ephesus-founded', churchId: 'ephesus', cityId: 'ephesus', year: 53, journeyId: 'journey-3', label: 'Church Established', sublabel: '12 disciples; Paul teaches 3 years', type: 'founding', ref: 'Acts 19:1–10' },
  { id: 'corinth-severe-letter', churchId: 'corinth', cityId: 'corinth', year: 55, journeyId: 'journey-3', label: 'Receives Severe Letter', sublabel: 'The lost letter; caused deep sorrow · 2 Co 2:4', type: 'letter-received', ref: '2 Co 2:4; 7:8' },

  // Rome Journey
  { id: 'phil-hears-paul-arrested', churchId: 'philippi', cityId: 'philippi', year: 57.5, journeyId: 'rome-journey', label: 'Hears Paul Is Imprisoned', sublabel: 'Sends Epaphroditus with prayers and gift', type: 'support', ref: 'Phil 1:5' },
  { id: 'ephesus-receives-ephesians', churchId: 'ephesus', cityId: 'ephesus', year: 61.5, journeyId: 'rome-journey', label: 'Receives Ephesians', sublabel: 'Carried by Tychicus · Eph 6:21', type: 'letter-received', ref: 'Ephesians 6:21' },

  // Post-Rome
  { id: 'ephesus-receives-1timothy', churchId: 'ephesus', cityId: 'ephesus', year: 63, journeyId: 'post-rome', label: 'Receives 1 Timothy', sublabel: 'Instructions for church order and doctrine', type: 'letter-received', ref: '1 Ti 1:3' },
  { id: 'ephesus-receives-2timothy', churchId: 'ephesus', cityId: 'ephesus', year: 67, journeyId: 'post-rome', label: 'Receives 2 Timothy', sublabel: 'Paul final letter; last known words', type: 'letter-received', ref: '2 Ti 4:9' }
];

d.churchEvents = [...d.churchEvents, ...extraChurchEvents];

fs.writeFileSync('./src/data/pauline-journeys-data.json', JSON.stringify(d, null, 2));
console.log('Done. paulEvents:', d.paulEvents.length, 'churchEvents:', d.churchEvents.length, 'journeys with eraLabels:', d.journeys.filter(j => j.eraLabels).length);
