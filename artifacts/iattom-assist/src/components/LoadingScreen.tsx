import { motion } from "framer-motion";
import logoSplash from "/logo-splash.png";

export function LoadingScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: "#000000" }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="flex flex-col items-center gap-6">

        {/* Logo — fundo preto da imagem funde com o fundo preto da tela */}
        <motion.img
          src={logoSplash}
          alt="IAttom Assist"
          width={260}
          height={260}
          className="object-contain"
          initial={{ scale: 0.82, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
        />

        {/* Ondulação dourada — rings concêntricos expandindo */}
        <div className="relative flex items-center justify-center" style={{ width: 180, height: 32 }}>
          {/* Brilho central */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 60,
              height: 8,
              background: "radial-gradient(ellipse at center, rgba(201,168,76,0.55) 0%, transparent 70%)",
              filter: "blur(4px)",
            }}
            animate={{ opacity: [0.4, 1, 0.4], scaleX: [0.8, 1.2, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Rings ondulando */}
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 40 + i * 36,
                height: 10 + i * 4,
                border: `1px solid rgba(201,168,76,${0.5 - i * 0.1})`,
                borderRadius: "50%",
              }}
              initial={{ scaleX: 0.5, opacity: 0 }}
              animate={{
                scaleX: [0.5, 1.1, 1],
                opacity: [0, 0.9, 0],
              }}
              transition={{
                duration: 2.0,
                repeat: Infinity,
                delay: i * 0.4,
                ease: "easeOut",
              }}
            />
          ))}
        </div>

        {/* 3 pontos dourados pulsantes */}
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.45 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="rounded-full"
              style={{ width: 6, height: 6, background: "#C9A84C" }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.75, 1.2, 0.75] }}
              transition={{
                duration: 1.1,
                repeat: Infinity,
                delay: i * 0.22,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>

      </div>
    </motion.div>
  );
}
