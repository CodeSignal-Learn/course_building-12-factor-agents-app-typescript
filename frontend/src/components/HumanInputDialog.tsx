import { FormEvent, useEffect, useState } from "react";

interface HumanInputDialogProps {
  isOpen: boolean;
  question: string;
  onSubmit: (answer: string) => void | Promise<void>;
  onClose: () => void;
}

function HumanInputDialog({ isOpen, question, onSubmit, onClose }: HumanInputDialogProps): JSX.Element | null {
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    if (isOpen) {
      setAnswer("");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const trimmedAnswer = answer.trim();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!trimmedAnswer) {
      return;
    }

    void onSubmit(trimmedAnswer);
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>Human Input Required</h2>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close dialog">
            x
          </button>
        </header>

        <p>{question}</p>

        <form onSubmit={handleSubmit}>
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            rows={4}
            autoFocus
            placeholder="Enter your response"
          />

          <div className="dialog-actions">
            <button type="submit" className="primary-button" disabled={!trimmedAnswer}>
              Submit
            </button>
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default HumanInputDialog;
