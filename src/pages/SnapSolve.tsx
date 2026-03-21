import { askAI } from "../services/ai";

export default function SnapSolve() {
  const handle = async (file: File) => {
    const result = await askAI("Solve this question");
    alert(result);
  };

  return (
    <div>
      <h1>Snap & Solve</h1>
      <input type="file" onChange={(e) => handle(e.target.files![0])} />
    </div>
  );
}