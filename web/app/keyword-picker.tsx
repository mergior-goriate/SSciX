"use client";

import { useId, useState } from "react";

const topics = [
  "Agricultura", "Ambiente", "Antropologia", "Astronomia", "Biologia", "Ciência de Dados",
  "Ciências da Saúde", "Ciências Sociais", "Comunicação", "Direito", "Economia", "Educação",
  "Energia", "Engenharia", "Física", "Geografia", "História", "Informática", "Inteligência Artificial",
  "Linguística", "Literatura", "Matemática", "Mudanças Climáticas", "Química", "Saúde Pública", "Sociologia",
];

export default function KeywordPicker({ value, setValue }: { value: string[]; setValue: (value: string[]) => void }) {
  const [query, setQuery] = useState("");
  const id = useId();
  const normalise = (word: string) => word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const options = [...new Set([...topics, ...value])].filter((topic) =>
    value.includes(topic) || normalise(topic).includes(normalise(query.trim())));
  return <fieldset className="keywords">
    <legend>Temas de investigação</legend>
    <label htmlFor={id}>Pesquisar temas</label>
    <input id={id} type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
    <small>{value.length} de 12 temas seleccionados</small>
    <div className="keyword-options">{options.map((topic) => {
      const checked = value.includes(topic);
      return <label className="check" key={topic}>
        <input type="checkbox" checked={checked} disabled={!checked && value.length >= 12}
          onChange={() => setValue(checked ? value.filter((word) => word !== topic) : [...value, topic])} />
        {topic}
      </label>;
    })}</div>
    {!options.length && <p>Nenhum tema encontrado.</p>}
  </fieldset>;
}
