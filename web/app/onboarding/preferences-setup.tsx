"use client";

import {
  ArrowLeft, Atom, BookOpen, ChartNoAxesCombined, Code2, GraduationCap, HeartPulse,
  Leaf, Microscope, Users, Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, message } from "../api-client";
import { useNetworkData } from "../use-network-data";
import "./onboarding.css";

const areas = [
  { label: "Educação", icon: GraduationCap, topics: ["Educação", "Ensino superior", "Formação de professores", "Aprendizagem digital"] },
  { label: "Saúde", icon: HeartPulse, topics: ["Saúde Pública", "Epidemiologia", "Nutrição", "Saúde mental"] },
  { label: "Ambiente", icon: Leaf, topics: ["Ambiente", "Agricultura", "Biodiversidade", "Mudanças Climáticas"] },
  { label: "Tecnologia", icon: Code2, topics: ["Informática", "Ciência de Dados", "Inteligência Artificial", "Informática na educação"] },
  { label: "Ciências da Vida", icon: Microscope, topics: ["Biologia", "Genética", "Microbiologia", "Biotecnologia"] },
  { label: "Ciências Exactas", icon: Atom, topics: ["Matemática", "Física", "Química", "Astronomia"] },
  { label: "Engenharia", icon: Wrench, topics: ["Engenharia", "Energia", "Infra-estruturas", "Materiais"] },
  { label: "Ciências Sociais", icon: Users, topics: ["Sociologia", "Antropologia", "Direito", "Políticas públicas"] },
  { label: "Humanidades", icon: BookOpen, topics: ["História", "Literatura", "Linguística", "Filosofia"] },
  { label: "Economia", icon: ChartNoAxesCombined, topics: ["Economia", "Finanças", "Desenvolvimento", "Empreendedorismo"] },
];

const identities = [
  ["woman", "Mulher"], ["man", "Homem"], ["nonbinary", "Não-binário"], [null, "Prefiro não dizer"],
] as const;

type Preferences = {
  gender: (typeof identities)[number][0];
  areas: string[];
  topics: string[];
};

const headings = ["Acerca de ti", "Escolhe as tuas áreas de interesse", "Personaliza o teu feed"];

function normalize(word: string) {
  return word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function toggle(options: string[], value: string) {
  return options.includes(value) ? options.filter((option) => option !== value) : [...options, value];
}

function Choice({ checked, disabled, onChange, children }: {
  checked: boolean; disabled?: boolean; onChange: () => void; children: ReactNode;
}) {
  return <label className="setup-choice">
    <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
    <span>{children}</span>
  </label>;
}

function PreferencesForm({ initial, editing }: { initial: Preferences; editing: boolean }) {
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState(initial);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const router = useRouter();

  useEffect(() => { heading.current?.focus(); }, [step]);

  const matches = normalize(query.trim());
  const relevantAreas = areas.filter(({ label }) => !preferences.areas.length || preferences.areas.includes(label));
  const topics = [...new Set([...preferences.topics, ...relevantAreas.flatMap((area) => area.topics)])]
    .filter((topic) => normalize(topic).includes(matches));
  const selectedOutsideSearch = preferences.topics.filter((topic) => !topics.includes(topic));

  function identify(gender: Preferences["gender"]) {
    setPreferences((current) => ({ ...current, gender }));
    setStep(1);
  }

  function chooseTopic(topic: string) {
    setPreferences((current) => ({ ...current, topics: toggle(current.topics, topic) }));
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/profiles/me/preferences", "PUT", preferences);
      router.replace(editing ? "/definicoes" : "/perfil");
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel setup-panel" aria-labelledby="setup-title">
    <header className="setup-navigation">
      {step > 0 ? <button className="secondary setup-back" type="button" disabled={busy} aria-label="Voltar"
        onClick={() => { setError(""); setStep(step - 1); }}><ArrowLeft size={20} aria-hidden="true" /></button> :
        editing ? <Link href="/definicoes">Cancelar</Link> : <span role="status">Email confirmado.</span>}
      <span>Passo {step + 1} de 3</span>
    </header>
    <h1 id="setup-title" ref={heading} tabIndex={-1}>{headings[step]}</h1>
    {step === 0 && <>
      <p className="setup-intro">Esta informação é opcional e fica reservada à tua conta.</p>
      <fieldset className="setup-identity">
        <legend>Como te identificas?</legend>
        {identities.map(([value, label]) => <button className="secondary" key={label} type="button"
          aria-pressed={preferences.gender === value} onClick={() => identify(value)}>{label}</button>)}
      </fieldset>
      <button className="setup-skip" type="button" onClick={() => setStep(1)}>Saltar</button>
    </>}
    {step === 1 && <>
      <p className="setup-intro">As áreas que escolheres ajudam a encontrar temas e publicações relevantes.</p>
      <div className="setup-areas" role="group" aria-label="Áreas de interesse">
        {areas.map(({ label, icon: Icon }) => <Choice key={label} checked={preferences.areas.includes(label)}
          onChange={() => setPreferences((current) => ({ ...current, areas: toggle(current.areas, label) }))}>
          <Icon size={24} aria-hidden="true" />{label}
        </Choice>)}
      </div>
      <button className="primary setup-continue" type="button" onClick={() => { setQuery(""); setStep(2); }}>
        {preferences.areas.length ? "Continuar" : "Continuar sem escolher áreas"}
      </button>
    </>}
    {step === 2 && <form className="setup-topics" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <p className="setup-intro">Selecciona até 12 temas para dar prioridade às publicações que te interessam.</p>
      <label>Pesquisar temas
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex. Saúde Pública" disabled={busy} />
      </label>
      <small role="status">{preferences.topics.length} de 12 temas seleccionados</small>
      <div className="setup-chips" role="group" aria-label="Temas de interesse">
        {[...topics, ...selectedOutsideSearch].map((topic) => {
          const checked = preferences.topics.includes(topic);
          return <Choice key={topic} checked={checked} disabled={busy || (!checked && preferences.topics.length >= 12)}
            onChange={() => chooseTopic(topic)}>{topic}</Choice>;
        })}
      </div>
      {!topics.length && <p>Nenhum tema corresponde à pesquisa.</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="primary setup-continue" disabled={busy}>
        {busy ? "A guardar…" : "Guardar e continuar"}
      </button>
    </form>}
  </section>;
}

export default function PreferencesSetup({ editing }: { editing: boolean }) {
  const { data, error, refresh } = useNetworkData<Preferences>("/profiles/me/preferences");
  return <main className="site-width setup-shell">
    {data ? <PreferencesForm initial={data} editing={editing} /> :
      <div className="panel">
        <p role={error ? "alert" : "status"}>{error || "A carregar as tuas preferências…"}</p>
        {error && <button className="secondary" type="button" onClick={refresh}>Tentar novamente</button>}
      </div>}
  </main>;
}
