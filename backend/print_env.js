console.log('Env keys:', Object.keys(process.env).filter(k => !k.startsWith('npm_')));
process.exit(0);
