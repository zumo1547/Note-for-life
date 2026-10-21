// Runs a multilingual model in the user's browser. No API key or note upload.
const MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
let enginePromise;

export function canUseLocalAi() {
  return Boolean(globalThis.navigator?.gpu);
}

async function getEngine(onProgress) {
  if (!canUseLocalAi()) throw new Error('เบราว์เซอร์นี้ไม่รองรับ WebGPU');
  if (!enginePromise) {
    enginePromise = (async () => {
      const { CreateMLCEngine } = await import('./vendor/webllm.mjs');
      return CreateMLCEngine(MODEL_ID, {
        initProgressCallback(progress) {
          const percent = Number.isFinite(progress.progress)
            ? Math.round(progress.progress * 100) : null;
          onProgress(percent === null ? 'กำลังเตรียมโมเดล AI...' : `กำลังดาวน์โหลด/เปิดโมเดล AI ${percent}%`);
        }
      });
    })().catch(error => { enginePromise = null; throw error; });
  }
  return enginePromise;
}

export async function summarizeOnDevice(source, selectedPoints, onProgress = () => {}) {
  const engine = await getEngine(onProgress);
  onProgress('AI กำลังเขียนสรุปภาษาไทยในเครื่อง...');
  const excerpts = source.length < 3200 ? source : source.slice(0, 1200);
  const points = selectedPoints.slice(0, 2100);
  const reply = await engine.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'คุณเป็นผู้ช่วยสรุปบทเรียนภาษาไทย เขียนหัวข้อและประเด็นสำคัญที่อ่านง่าย ใช้เฉพาะข้อมูลที่ได้รับ ห้ามแต่งตัวเลข ชื่อ หรือข้อเท็จจริง ถ้าข้อมูลไม่พอให้บอกตรง ๆ'
      },
      {
        role: 'user',
        content: `สรุปข้อมูลต่อไปนี้เป็นภาษาไทยแบบกระชับและมีหัวข้อย่อย\n\nช่วงต้นของต้นฉบับ:\n${excerpts}\n\nประเด็นที่คัดจากส่วนต่าง ๆ ของเอกสาร:\n${points}`
      }
    ],
    temperature: 0.2,
    max_tokens: 550
  });
  const content = reply.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('โมเดลไม่ส่งสรุปกลับมา');
  return content.trim();
}
