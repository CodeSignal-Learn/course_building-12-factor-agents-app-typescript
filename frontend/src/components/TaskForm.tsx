import { Send } from "lucide-react";
import { FormEvent, useState } from "react";

interface TaskFormProps {
  onSubmit: (prompt: string) => void | Promise<void>;
  isSubmitting: boolean;
}

function TaskForm({ onSubmit, isSubmitting }: TaskFormProps): JSX.Element {
  const [prompt, setPrompt] = useState("");
  const trimmedPrompt = prompt.trim();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!trimmedPrompt || isSubmitting) {
      return;
    }

    void onSubmit(trimmedPrompt);
    setPrompt("");
  };

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <label htmlFor="task-prompt">Task</label>
      <textarea
        id="task-prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Solve the roots of this equation: x^2 - 5x + 6 = 0"
        rows={3}
        disabled={isSubmitting}
      />
      <button type="submit" disabled={!trimmedPrompt || isSubmitting} className="primary-button">
        <Send size={18} />
        <span>{isSubmitting ? "Launching" : "Launch Agent"}</span>
      </button>
    </form>
  );
}

export default TaskForm;
