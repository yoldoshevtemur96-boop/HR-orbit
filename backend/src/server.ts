import { app } from './app';
import { env } from '@/config/env';

app.listen(env.port, () => {
  console.log(`HR Orbit backend http://localhost:${env.port} portida ishga tushdi (${env.nodeEnv})`);
});
