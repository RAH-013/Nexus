import { env } from "./config/env";
import { app } from "./app";

app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`API running on port ${env.PORT}`);
});
