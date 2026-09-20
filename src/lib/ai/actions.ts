import { CORE_FORENSIC_PROMPT } from "@/lib/ai/core-prompt";
import { PROMPT_VERSION } from "@/domain/types";

export interface ForensicAction {
  id: string;
  number: string;
  name: string;
  shortName: string;
  description: string;
  promptVersion: string;
  systemPromptId: "FORENX_CORE";
  requiredInputs: Array<"evidence" | "case" | "findings">;
  task: string;
}

export const FORENSIC_ACTIONS: ForensicAction[] = [
  {
    id: "auto-triage",
    number: "01",
    name: "Automatické triedenie",
    shortName: "Triedenie",
    description: "Zaradí dôkaz do sekcií pracoviska, bez posudzovania viny.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence", "case"],
    task: `TASK: FORENSIC EVIDENCE TRIAGE
Examine the supplied evidence and determine how it should be routed inside the case workspace.
Do not decide whether the subject committed wrongdoing.
Determine: primary evidence category; secondary categories; likely document or media type; apparent purpose; languages; people, organizations and systems visibly involved; date range; whether OCR/text quality is sufficient; whether additional parsing is required; whether sensitive information appears present; whether the evidence appears relevant to another existing evidence item; recommended next forensic actions.
Assign one primary workspace section from: IDENTITY, COMMUNICATION, FINANCIAL, CONTRACT, TECHNICAL, MEDIA, TIMELINE, LEGAL_DOCUMENT, ADMINISTRATIVE, LOCATION, OTHER.
Return confidence for every classification. Unsupported classifications must be UNKNOWN.`,
  },
  {
    id: "document-classify",
    number: "02",
    name: "Klasifikácia dokumentu",
    shortName: "Klasifikácia",
    description: "Klasifikuje podľa skutočného obsahu, nie podľa názvu súboru.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: DOCUMENT CLASSIFICATION
Classify the supplied document according to actual observable contents rather than filename or extension.
Identify: documentType, documentSubtype, probablePurpose, issuer, recipient, language, date, jurisdictionIfExplicit, versionIndicators, signatureIndicators, attachmentReferences, relatedDocumentReferences.
Possible types: invoice, receipt, contract, agreement, letter, email, statement, report, identity_document, court_document, application, form, technical_report, financial_record, conversation_export, screenshot, photo, spreadsheet, presentation, source_code, log, unknown.
Distinguish explicit facts from inferred classification. Do not infer issuer, recipient or jurisdiction unless evidence supports it.`,
  },
  {
    id: "ocr-structure",
    number: "03",
    name: "OCR a štruktúra",
    shortName: "Štruktúra",
    description: "Obnoví štruktúru dokumentu z extrahovaného textu.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: DOCUMENT STRUCTURE RECONSTRUCTION
Analyze the provided document extraction. Reconstruct logical hierarchy while preserving original reading order.
Identify: title, subtitle, sections, headings, paragraphs, tables, lists, footnotes, headers, footers, pageNumbers, captions, signatures, stamps, handwrittenRegions, formFields, keyValuePairs.
Do not silently correct material values. Where text is uncertain, preserve originalText, suggestedReading, confidence.
Never manufacture text missing from the source.`,
  },
  {
    id: "metadata-analysis",
    number: "04",
    name: "Analýza metadát",
    shortName: "Metadáta",
    description: "Interpretuje len metadáta, ktoré dodal parser.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: FORENSIC METADATA INTERPRETATION
Analyze only metadata explicitly supplied by forensic parsers. Do not invent metadata that was not extracted.
Review timestamps, software identifiers, author fields, device identifiers, GPS, document properties, EXIF, encoding, page counts, dimensions, revision information.
Identify normal observations, interesting correlations, timestamp conflicts, software/version inconsistencies, missing expected metadata, possible transformations.
A metadata anomaly is not proof of manipulation.
For every anomaly provide: observation, sourceField, possibleBenignExplanations, possibleInvestigativeSignificance, confidence, recommendedVerification.`,
  },
  {
    id: "executive-summary",
    number: "05",
    name: "Zhrnutie dôkazu",
    shortName: "Zhrnutie",
    description: "Stručné zhrnutie vybraného dôkazu pre vyšetrovateľa.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: EVIDENCE SUMMARY
Produce a concise investigator-oriented summary of the selected evidence.
Prioritize: who, what, when, where, how, amounts, identifiers, relationships, actions, obligations, technical indicators.
Separate output into: observedFacts, importantInferences, unresolvedQuestions, highValueReferences.
Every important statement must include provenance. Do not introduce facts not present in the evidence.`,
  },
  {
    id: "key-facts",
    number: "06",
    name: "Kľúčové fakty",
    shortName: "Fakty",
    description: "Vyberie jednotlivé tvrdenia, ktoré možno overiť samostatne.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: ATOMIC FACT EXTRACTION
Extract individual factual assertions. Each fact is one independently reviewable claim.
For every fact return: factId, statement, epistemicClass, subjects, objects, dateOrTime, location, sourceReference, confidence.
Prefer many precise atomic facts over broad summaries. Direct quotations must be preserved exactly where available.`,
  },
  {
    id: "entity-extraction",
    number: "07",
    name: "Extrakcia entít",
    shortName: "Entity",
    description: "Vyberie osoby, organizácie a identifikátory, ktoré sú v dôkaze priamo uvedené.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: FORENSIC ENTITY EXTRACTION
Extract entities explicitly supported by the evidence.
Classes: PERSON, ORGANIZATION, EMAIL, PHONE, ADDRESS, LOCATION, DOMAIN, URL, IP_ADDRESS, DEVICE, ACCOUNT, BANK_ACCOUNT, CRYPTO_ADDRESS, VEHICLE, DOCUMENT_ID, TRANSACTION_ID, USERNAME, SOCIAL_ACCOUNT, DATE, OTHER_IDENTIFIER.
For every entity: canonicalValue, originalRepresentation, entityType, sourceReferences, confidence, aliases.
Never merge two entities only because names look similar. Potential matches are candidate relationships, not confirmed identity.`,
  },
  {
    id: "timeline",
    number: "08",
    name: "Časová os",
    shortName: "Časová os",
    description: "Zostaví chronológiu udalostí s označením presnosti času.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: FORENSIC TIMELINE CONSTRUCTION
Extract chronologically relevant events.
For each event: eventId, timestampOriginal, timestampNormalized, timezone, timePrecision, eventType, actors, action, objects, location, sourceReferences, confidence.
timePrecision must be one of: EXACT, MINUTE, HOUR, DAY, MONTH, YEAR, APPROXIMATE, UNKNOWN.
Never invent missing time components. Flag chronological conflicts separately.`,
  },
  {
    id: "relationship-map",
    number: "09",
    name: "Mapa vzťahov",
    shortName: "Vzťahy",
    description: "Zobrazí len vzťahy, ktoré dôkaz skutočne podporuje.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: EVIDENCE RELATIONSHIP ANALYSIS
Construct relationships only from supported evidence.
Node types may include person, organization, account, device, file, document, email, phone, domain, address, transaction, location, event.
Relationship examples: SENT_TO, RECEIVED_FROM, OWNS, MENTIONS, SIGNED, PAID, TRANSFERRED_TO, CONNECTED_TO, LOCATED_AT, CREATED, MODIFIED, REFERENCES, COMMUNICATED_WITH, USES, POSSIBLY_ASSOCIATED_WITH.
For each edge: sourceNode, relationship, targetNode, sourceReferences, epistemicClass, confidence.
Do not convert POSSIBLY_ASSOCIATED_WITH into a confirmed relationship without additional evidence.`,
  },
  {
    id: "contradictions",
    number: "10",
    name: "Rozpory",
    shortName: "Rozpory",
    description: "Nájde nezlučiteľné alebo podstatne odlišné tvrdenia.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: CONTRADICTION AND CONSISTENCY REVIEW
Compare selected evidence items for incompatible or materially different claims.
For every potential contradiction: topic, claimA, sourceA, claimB, sourceB, conflictType, severity, possibleExplanations, requiredEvidence, confidence.
Conflict types: DIRECT_CONTRADICTION, DATE_MISMATCH, AMOUNT_MISMATCH, IDENTITY_MISMATCH, LOCATION_MISMATCH, VERSION_DIFFERENCE, PARTIAL_CONFLICT, POSSIBLE_CONTEXT_DIFFERENCE.
Do not label two statements contradictory merely because one contains additional detail.`,
  },
  {
    id: "duplicates",
    number: "11",
    name: "Kontrola duplikátov",
    shortName: "Duplikáty",
    description: "Rozlíši duplikáty, revízie, šablóny a výňatky.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: DOCUMENT SIMILARITY ANALYSIS
Determine whether selected evidence items may represent exact duplicates, format-converted duplicates, revisions, templates, screenshots of another source, partial copies, quoted extracts, or unrelated documents.
Use supplied hashes, normalized text, metadata and extracted structure.
Never claim binary identity without matching cryptographic hashes.
Return relationshipType, evidenceA, evidenceB, supportingSignals, conflictingSignals, confidence.`,
  },
  {
    id: "pii-secrets",
    number: "12",
    name: "Osobné údaje a tajomstvá",
    shortName: "Citlivé údaje",
    description: "Nájde citlivé informácie a zobrazí ich v redigovanej podobe.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: SENSITIVE INFORMATION DISCOVERY
Identify potentially sensitive information.
Categories: personal identifiers, addresses, emails, phones, government IDs, financial accounts, payment cards, authentication tokens, API credentials, password-like values, private keys, medical information, confidential business information.
Do not reproduce complete secrets. Return a redacted representation (e.g. sk-****91x).
For each finding: category, redactedValue, location, sourceReference, confidence, recommendedHandling.
Do not classify ordinary random-looking strings as credentials without contextual support.`,
  },
  {
    id: "financial",
    number: "13",
    name: "Finančná analýza",
    shortName: "Financie",
    description: "Transakcie, sumy a nezrovnalosti.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: FINANCIAL EVIDENCE ANALYSIS
Extract and correlate financial information: transactions, amounts, currencies, accounts, counterparties, invoice identifiers, payment references, tax values, balances, payment dates, due dates, crypto transactions where explicitly present.
For each monetary figure preserve originalAmount, currency, normalizedAmount only if conversion data is explicitly supplied, sourceReference.
Look for duplicate payments, amount discrepancies, invoice/payment relationships, unexplained transfers, round-number patterns, chronological inconsistencies.
Patterns are investigative signals, not proof of wrongdoing. Return calculations separately from source observations.`,
  },
  {
    id: "communication",
    number: "14",
    name: "Analýza komunikácie",
    shortName: "Komunikácia",
    description: "E-maily, správy a korešpondencia.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: COMMUNICATION EVIDENCE ANALYSIS
Analyze supplied emails, messages, chat exports or correspondence.
Extract: participants, sender, recipients, timestamps, subject, conversation threads, attachments, requests, commitments, decisions, disagreements, references to money, documents, meetings or locations.
Identify changes in position or materially conflicting statements over time.
Distinguish: direct statement, quoted statement, forwarded material, investigator inference.
Do not infer emotion, intent or deception solely from writing style.`,
  },
  {
    id: "contract",
    number: "15",
    name: "Analýza zmluvy",
    shortName: "Zmluva",
    description: "Strany, povinnosti a podmienky — bez právnych záverov.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: CONTRACTUAL DOCUMENT ANALYSIS
Extract: parties, effectiveDate, terminationDate, obligations, rights, paymentTerms, amounts, deadlines, renewalTerms, terminationTerms, confidentialityTerms, liabilityTerms, governingLaw if explicitly stated, signatureInformation, referencedAttachments.
Flag missing referenced documents, inconsistent dates, different contract versions, unsigned sections, blank material fields, conflicting amounts.
Do not provide definitive legal conclusions. Describe textual evidence and potential issues for human/legal review.`,
  },
  {
    id: "technical-ioc",
    number: "16",
    name: "Technické indikátory",
    shortName: "Indikátory",
    description: "Technické stopy, ktoré sú v dôkaze priamo prítomné.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: TECHNICAL INDICATOR EXTRACTION
Extract technical indicators: IP, DOMAIN, URL, EMAIL, FILE_HASH, HOSTNAME, USER_AGENT, PORT, PROTOCOL, FILE_PATH, REGISTRY_PATH, PROCESS, SERVICE, PACKAGE, SOFTWARE_VERSION, CVE, CRYPTO_ADDRESS, OTHER_TECHNICAL_IDENTIFIER.
For each: value, type, sourceReference, context, confidence.
Separate literal indicators from inferred indicators.
Do not classify an indicator as malicious unless explicit external reputation data or supplied evidence supports that classification.`,
  },
  {
    id: "authenticity",
    number: "17",
    name: "Kontrola pravosti",
    shortName: "Pravosť",
    description: "Nezrovnalosti, ktoré treba overiť ručne.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence"],
    task: `TASK: DOCUMENT AND MEDIA ANOMALY REVIEW
Review extracted features, metadata and text for inconsistencies that warrant human examination.
Categories: metadata inconsistency, timestamp inconsistency, font inconsistency, layout anomaly, compression anomaly, unexpected software signature, duplicate region, editing indicator, OCR mismatch, missing expected field, signature inconsistency, document revision mismatch.
For each observation: anomaly, evidenceReference, observedSignal, possibleBenignExplanations, possibleInvestigativeSignificance, confidence, recommendedVerification.
Never conclude forged, manipulated or authentic solely from weak indicators.
Use: consistent, inconsistent, unusual, requiresVerification.`,
  },
  {
    id: "evidence-gaps",
    number: "18",
    name: "Medzery v dôkazoch",
    shortName: "Medzery",
    description: "Chýbajúce dôkazy, ktoré obmedzujú analýzu.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence", "case", "findings"],
    task: `TASK: CASE EVIDENCE GAP ANALYSIS
Review current case facts, findings, timeline and entities.
Identify unanswered questions or missing evidence that materially limits the analysis.
For every gap: question, whyItMatters, existingEvidence, missingEvidence, possibleEvidenceSources, priority, confidence.
Priority: CRITICAL, HIGH, MEDIUM, LOW.
Do not request evidence merely because it might exist. Separate missing, unclear, conflicting, and unverified inference.`,
  },
  {
    id: "investigator-questions",
    number: "19",
    name: "Otázky pre vyšetrovateľa",
    shortName: "Otázky",
    description: "Dôležité otázky, bez obviňovania.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence", "case", "findings"],
    task: `TASK: GENERATE INVESTIGATIVE QUESTIONS
Based solely on current evidence, generate high-value questions for the investigator.
Questions should help clarify contradictions, verify identities, resolve timeline gaps, explain transactions, establish provenance, confirm relationships, locate missing documents, test competing hypotheses.
For every question: question, purpose, evidenceThatTriggeredQuestion, expectedInformationGain, priority.
Avoid accusatory wording. Do not assume wrongdoing.`,
  },
  {
    id: "case-report",
    number: "20",
    name: "Správa o prípade",
    shortName: "Správa",
    description: "Štruktúrovaná správa zostavená výhradne z citovaných dôkazov.",
    promptVersion: PROMPT_VERSION,
    systemPromptId: "FORENX_CORE",
    requiredInputs: ["evidence", "case", "findings"],
    task: `TASK: FORENSIC CASE REPORT GENERATION
Generate a structured case analysis based exclusively on supplied findings and cited evidence.
Report sections:
1. Case overview
2. Evidence inventory
3. Examination methodology
4. Key observed facts
5. Entity overview
6. Timeline
7. Material relationships
8. Financial findings if applicable
9. Technical findings if applicable
10. Contradictions
11. Anomalies requiring review
12. Evidence gaps
13. Investigative hypotheses
14. Recommended verification steps
15. Limitations
Every material finding must include source references.
Separate OBSERVED FACT, DERIVED RESULT, ANALYTIC INFERENCE, HYPOTHESIS.
Do not claim legal guilt, authenticity, authorship or intent unless independently established by evidence explicitly provided.
Finish with an evidence coverage assessment.
Put the full report into reportMarkdown and also populate findings/entities/events where applicable.`,
  },
];

export function getAction(id: string): ForensicAction | undefined {
  return FORENSIC_ACTIONS.find((a) => a.id === id);
}

export function buildSystemPrompt(action: ForensicAction): string {
  return `${CORE_FORENSIC_PROMPT}

WORKSPACE LANGUAGE: Slovak (sk).
Write all human-readable fields (title, summary, statement, questions, anomalies, reportMarkdown, eventType, action, and similar free text) in Slovak.
Keep JSON keys and enum values in English exactly as specified.
Preserve original quotations in their source language.

ACTION
${action.task}

OUTPUT CONTRACT
Return a single JSON object with this shape:
{
  "title": string,
  "summary": string,
  "primarySection": "IDENTITY"|"COMMUNICATION"|"FINANCIAL"|"CONTRACT"|"TECHNICAL"|"MEDIA"|"TIMELINE"|"LEGAL_DOCUMENT"|"ADMINISTRATIVE"|"LOCATION"|"OTHER"|null,
  "findings": [{
    "statement": string,
    "epistemicClass": "OBSERVED"|"DERIVED"|"INFERRED"|"HYPOTHESIS"|"UNKNOWN",
    "confidence": number,
    "evidenceId": string | null,
    "fileName": string | null,
    "page": number | null,
    "excerpt": string | null
  }],
  "entities": [{
    "entityType": string,
    "canonicalValue": string,
    "originalRepresentation": string,
    "aliases": string[],
    "confidence": number,
    "evidenceId": string | null,
    "fileName": string | null
  }],
  "events": [{
    "timestampOriginal": string,
    "timestampNormalized": string | null,
    "timezone": string | null,
    "timePrecision": "EXACT"|"MINUTE"|"HOUR"|"DAY"|"MONTH"|"YEAR"|"APPROXIMATE"|"UNKNOWN",
    "eventType": string,
    "actors": string[],
    "action": string,
    "objects": string[],
    "location": string | null,
    "confidence": number,
    "evidenceId": string | null,
    "fileName": string | null
  }],
  "questions": string[],
  "anomalies": string[],
  "reportMarkdown": string | null
}
Use empty arrays when a field does not apply. Do not invent evidenceIds. Confidence is 0 to 1.`;
}
