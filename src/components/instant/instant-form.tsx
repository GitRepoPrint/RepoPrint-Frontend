"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "@/components/ui/icon";

type InstantFormProps = {
  loading: boolean;
  onSubmit: (url: string) => void;
};

export function InstantForm({ loading, onSubmit }: InstantFormProps) {
  const [url, setUrl] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(url);
  }

  return (
    <>
      <form className="search-box" onSubmit={handleSubmit}>
        <Icon name="github" size={22} className="search-icon" />
        <input
          aria-label="GitHub repository URL"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://github.com/org/repo"
        />
        <button type="submit" className="button button-primary" disabled={loading}>
          {loading ? (
            <><span className="analysis-spinner" /> Analyzing...</>
          ) : (
            <>Analyze Repository <Icon name="arrowRight" size={17} /></>
          )}
        </button>
      </form>
      <div className="search-caption">
        <Icon name="lock" size={12} /> No account needed to preview <span>·</span> Public repositories only
      </div>
    </>
  );
}
