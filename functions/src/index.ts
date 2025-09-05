
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

export const persistCallSummary = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
    const { call_id, lead_id, audio_url, transcript_url, summary, metrics } = req.body || {};
    if (!call_id) { res.status(400).send('call_id required'); return; }

    await db.collection('voice_calls').doc(call_id).set({
      call_id, lead_id: lead_id || null,
      audio_url: audio_url || null,
      transcript_url: transcript_url || null,
      summary: summary || '',
      metrics: metrics || {},
      created_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.status(200).json({ ok: true });
  } catch (e:any) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});
