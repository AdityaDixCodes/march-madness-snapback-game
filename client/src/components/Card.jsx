import { useState, useEffect } from "react";
import "./Card.css";

export default function Card({ subject, mode, isEliminated, onEliminate, guessMode, isSelected, onGuessSelect }) {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!showModal) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setShowModal(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showModal]);

  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showModal]);

  const handleCardClick = () => {
    if (guessMode) {
      onGuessSelect(subject);
      return;
    }
    if (isEliminated) {
      onEliminate(subject.id, false);
    } else {
      setShowModal(true);
    }
  };

  const handleEliminate = () => {
    onEliminate(subject.id, true);
    setShowModal(false);
  };

  const renderStats = () => {
    if (mode === "player") {
      return [
        { label: "Team", value: subject.team },
        { label: "Position", value: subject.position },
        { label: "PPG (reg. season)", value: subject.ppg },
        { label: "Height", value: `${subject.height_ft}'${subject.height_in}"` },
        { label: "Class Year", value: subject.class_year },
        { label: "Conference", value: subject.conference },
        { label: "Starter", value: subject.starter ? "Yes" : "No" },
        { label: "Hometown", value: subject.hometown },
      ];
    } else {
      return [
        { label: "Conference", value: subject.conference },
        { label: "Region", value: subject.region },
        { label: "State", value: subject.state },
        { label: "Record", value: subject.record },
        { label: "Mascot", value: subject.mascot },
        { label: "Mascot Type", value: subject.mascot_type },
        { label: "Public School", value: subject.public ? "Yes" : "No" },
        { label: "Championships", value: subject.championships },
        { label: "Colors", value: subject.colors.join(", ") },
      ];
    }
  };

  const hasPhoto = !!(subject.photo_url || subject.logo_url);
  const initials = subject.name.split(" ").map(w => w[0]).join("").slice(0, 2);

  return (
    <>
      <div
        className={`card ${isEliminated ? "eliminated" : ""} ${isSelected ? "selected" : ""} ${guessMode && !isEliminated ? "guessable" : ""}`}
        onClick={handleCardClick}
        title={isEliminated ? "Click to restore" : guessMode ? "Click to guess" : "Click to view info"}
      >
        <div className="card-front">
          <div className="card-photo">
            {hasPhoto ? (
              <img
                src={subject.photo_url || subject.logo_url}
                alt={subject.name}
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.nextSibling.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className="card-photo-placeholder"
              style={{ display: hasPhoto ? "none" : "flex" }}
            >
              {initials}
            </div>
          </div>
          <div className="card-name">{subject.name}</div>
          {mode === "player" && (
            <div className="card-sub">{subject.team} · {subject.position}</div>
          )}
          {mode === "team" && (
            <div className="card-sub">{subject.conference}</div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>

            <div className="modal-header">
              <div className="modal-photo">
                {hasPhoto ? (
                  <img
                    src={subject.photo_url || subject.logo_url}
                    alt={subject.name}
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className="modal-photo-placeholder"
                  style={{ display: hasPhoto ? "none" : "flex" }}
                >
                  {initials}
                </div>
              </div>
              <div className="modal-title-block">
                <h2 className="modal-name">{subject.name}</h2>
                {mode === "player" && (
                  <p className="modal-sub">{subject.team} · {subject.position} · {subject.class_year}</p>
                )}
                {mode === "team" && (
                  <p className="modal-sub">{subject.conference} · {subject.region} Region</p>
                )}
              </div>
              <button className="modal-close-x" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="modal-stats">
              {renderStats().map(({ label, value }) => (
                <div className="modal-stat" key={label}>
                  <span className="modal-stat-label">{label}</span>
                  <span className="modal-stat-value">{value}</span>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="modal-btn-eliminate" onClick={handleEliminate}>
                Eliminate This {mode === "player" ? "Player" : "Team"}
              </button>
              <button className="modal-btn-close" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}