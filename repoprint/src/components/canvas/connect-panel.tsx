"use client";

import { useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icon";

type Item = { id: string; title: string };
type Flow = { id: string; from: string; to: string };

type ConnectPanelProps = {
  id: string;
  nodes: Item[];
  flows: Flow[];
  onAdd: (source: string, target: string) => void;
  onRemove: (id: string) => void;
};

/** Alternativa ao arrasto: ligar e desligar componentes com o teclado. */
export function ConnectPanel({ id, nodes, flows, onAdd, onRemove }: ConnectPanelProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const ready = from !== "" && to !== "" && from !== to;

  function openOnEnter(event: KeyboardEvent<HTMLSelectElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    try {
      event.currentTarget.showPicker();
    } catch {
      event.currentTarget.focus();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (ready) onAdd(from, to);
  }

  return (
    <section id={id} className="connect-panel" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>Connect components</h3>
      <form onSubmit={submit}>
        <label>
          From
          <select value={from} onChange={(event) => setFrom(event.target.value)} onKeyDown={openOnEnter}>
            <option value="">Choose a component</option>
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
          </select>
        </label>
        <label>
          To
          <select value={to} onChange={(event) => setTo(event.target.value)} onKeyDown={openOnEnter}>
            <option value="">Choose a component</option>
            {nodes.filter((n) => n.id !== from).map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
          </select>
        </label>
        <button type="submit" className="button button-primary" disabled={!ready}><Icon name="plus" size={15} /> Add data flow</button>
      </form>
      <h4>Data flows ({flows.length})</h4>
      <ul>
        {flows.map((flow) => (
          <li key={flow.id}>
            <span>{flow.from} <span aria-hidden="true">→</span><span className="sr-only">to</span> {flow.to}</span>
            <button type="button" onClick={() => onRemove(flow.id)} aria-label={`Remove data flow from ${flow.from} to ${flow.to}`}>Remove</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
