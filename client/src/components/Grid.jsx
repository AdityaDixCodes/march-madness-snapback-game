import Card from "./Card";
import "./Grid.css";

export default function Grid({ grid, mode, eliminatedIds, onEliminate, guessMode, selectedGuessId, onGuessSelect }) {
  return (
    <div className="grid-container">
      <div className="grid-header">
        <span className="grid-count">
          {grid.length - eliminatedIds.length} remaining
        </span>
        {guessMode && (
          <span className="grid-guess-mode">
            🎯 Guess Mode — click a card
          </span>
        )}
      </div>
      <div className="grid">
        {grid.map((subject) => (
          <Card
            key={subject.id}
            subject={subject}
            mode={mode}
            isEliminated={eliminatedIds.includes(subject.id)}
            onEliminate={onEliminate}
            guessMode={guessMode}
            isSelected={selectedGuessId === subject.id}
            onGuessSelect={onGuessSelect}
          />
        ))}
      </div>
    </div>
  );
}