"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", display: "grid", gap: "0.75rem" }}>
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={item.question}
            style={{
              border: isOpen ? "1px solid #5B34EA" : "1px solid var(--line, #E2E8F0)",
              borderRadius: "10px",
              background: "#FFFFFF",
              overflow: "hidden",
              transition: "border-color 0.2s ease",
            }}
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              style={{
                width: "100%",
                padding: "1.1rem 1.25rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                textAlign: "left",
                background: "none",
                border: "none",
                cursor: "pointer",
                gap: "1rem",
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  fontSize: "1.02rem",
                  color: isOpen ? "#5B34EA" : "var(--ink, #0F172A)",
                }}
              >
                {item.question}
              </span>
              <span style={{ color: isOpen ? "#5B34EA" : "var(--muted, #64748B)", flexShrink: 0 }}>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </span>
            </button>
            {isOpen && (
              <div
                style={{
                  padding: "0 1.25rem 1.1rem 1.25rem",
                  color: "var(--muted, #475569)",
                  fontSize: "0.92rem",
                  lineHeight: "1.6",
                  borderTop: "1px solid #F1F5F9",
                  paddingTop: "0.75rem",
                }}
              >
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
