import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";

const app=express();
app.use(cors());
app.use(express.json({limit:"2mb"}));
const sessions=new Map();
const PORT=process.env.PORT||8787;
const MODEL=process.env.OPENAI_MODEL||"gpt-5-mini";

const schema={
  type:"object",additionalProperties:false,
  properties:{
    action:{type:"string",enum:["probe","clarify","advance","change_topic","increase_difficulty","decrease_difficulty","finish"]},
    competency:{type:"string"},
    difficulty:{type:"integer",minimum:1,maximum:5},
    question:{type:"string"},
    analysis:{type:"string"},
    topics:{type:"array",items:{type:"string"}},
    evidence:{type:"array",items:{type:"string"}},
    missing_evidence:{type:"array",items:{type:"string"}},
    contradictions:{type:"array",items:{type:"string"}}
  },
  required:["action","competency","difficulty","question","analysis","topics","evidence","missing_evidence","contradictions"]
};

async function agent(state, latestAnswer=""){
  if(!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing.");
  const history=state.turns.map(t=>({question:t.question,answer:t.answer,decision:t.action,competency:t.competency}));
  const instructions=`You are the controller for a live technical interview. You must dynamically decide the next question from the candidate's resume/profile and their actual previous answers. Never follow a fixed question bank or predetermined sequence.

Rules:
- Ask exactly one concise, spoken-language-friendly question at a time.
- Treat Indian English as normal English. Understand Indian technical vocabulary and phrasing without stereotyping or correcting accent/grammar.
- Probe concrete claims and missing evidence. If vague, clarify. If strong, raise difficulty. If "I don't know", reframe or lower difficulty. If off-topic, steer back. If a new answer conflicts with earlier evidence or the profile, record the contradiction and ask neutrally when useful.
- Do not ask substantially repeated questions.
- Cover role-relevant competencies over time, but let evidence drive the path.
- Never infer protected traits or use them in evaluation.
- Do not make a hire/reject decision. Produce interview evidence for human review.
- analysis is a short factual rationale suitable for an interviewer dashboard, not hidden chain-of-thought.
- If the interview has enough evidence after roughly 6-10 meaningful turns, action may be finish and question should be a brief closing message.`;

  const input=JSON.stringify({
    candidate:{name:state.name,role:state.role,profile:state.profile},
    interview:{difficulty:state.difficulty,turnCount:state.turns.length,history},
    latestAnswer:latestAnswer||null,
    task: state.turns.length===0 ? "Generate the first adaptive interview question." : "Evaluate the latest answer and choose the next action and question."
  });

  const res=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      model:MODEL,
      instructions,
      input,
      text:{format:{type:"json_schema",name:"interview_turn",strict:true,schema}}
    })
  });
  if(!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
  const data=await res.json();
  const text=data.output_text ?? data.output?.flatMap(x=>x.content||[]).find(x=>x.type==="output_text")?.text;
  if(!text) throw new Error("Agent returned no structured output.");
  return JSON.parse(text);
}

app.get("/api/health",(_,res)=>res.json({ok:true,model:MODEL,aiConfigured:Boolean(process.env.OPENAI_API_KEY)}));

app.post("/api/interview/start",async(req,res)=>{
  try{
    const {name="Candidate",role="Software Engineer",profile=""}=req.body||{};
    const id=crypto.randomUUID();
    const state={id,name,role,profile,difficulty:2,turns:[],createdAt:new Date().toISOString()};
    const next=await agent(state);
    state.difficulty=next.difficulty;
    state.pending=next;
    sessions.set(id,state);
    res.json({sessionId:id,next});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post("/api/interview/turn",async(req,res)=>{
  try{
    const {sessionId,answer}=req.body||{};
    const state=sessions.get(sessionId);
    if(!state) return res.status(404).json({error:"Interview session not found."});
    if(!answer?.trim()) return res.status(400).json({error:"Answer cannot be empty."});
    const prev=state.pending;
    const next=await agent(state,answer.trim());
    state.turns.push({
      question:prev.question,answer:answer.trim(),action:next.action,
      competency:next.competency,difficulty:next.difficulty,analysis:next.analysis,
      topics:next.topics,evidence:next.evidence,missingEvidence:next.missing_evidence,
      contradictions:next.contradictions
    });
    state.difficulty=next.difficulty;
    state.pending=next;
    res.json({next,turnNumber:state.turns.length});
  }catch(e){res.status(500).json({error:e.message});}
});

app.get("/api/interview/:id",(req,res)=>{
  const state=sessions.get(req.params.id);
  if(!state) return res.status(404).json({error:"Interview session not found."});
  res.json(state);
});

app.listen(PORT,()=>console.log(`NAIN interview API on http://localhost:${PORT}`));
