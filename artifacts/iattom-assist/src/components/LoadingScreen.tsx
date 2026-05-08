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
      <div className="flex flex-col items-center gap-4">

        {/* Logo */}
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

        {/* Ondulação dourada premium */}
        <div className="relative flex items-center justify-center" style={{ width: 300, height: 56 }}>

          {/* Glow central intenso */}
          <motion.div
            className="absolute"
            style={{
              width: 140,
              height: 18,
              background: "radial-gradient(ellipse at center, rgba(201,168,76,0.9) 0%, rgba(201,168,76,0.3) 45%, transparent 75%)",
              filter: "blur(8px)",
              borderRadius: "50%",
            }}
            animate={{
              opacity: [0, 0.3, 1, 1, 0.5, 0],
              scaleX: [0.4, 0.8, 1.2, 1.4, 1.1, 0.8],
              scaleY: [0.5, 0.9, 1.1, 1.3, 1.0, 0.7],
            }}
            transition={{ duration: 3, ease: "easeInOut", times: [0, 0.15, 0.45, 0.6, 0.8, 1] }}
          />

          {/* Rings ondulando — líquido dourado */}
          {[0, 1, 2, 3, 4].map((i) => {
            const w = 60 + i * 46;
            const h = 14 + i * 6;
            return (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  width: w,
                  height: h,
                  border: `${i < 2 ? 2 : 1}px solid rgba(201,168,76,${0.85 - i * 0.14})`,
                  borderRadius: "50%",
                  boxShadow: i < 2 ? `0 0 ${8 + i * 6}px rgba(201,168,76,0.35)` : "none",
                }}
                initial={{ scaleX: 0.2, scaleY: 0.3, opacity: 0 }}
                animate={{
                  scaleX: [0.2, 0.7, 1.05, 0.95, 1],
                  scaleY: [0.3, 0.8, 1.1, 0.95, 1],
                  opacity: [0, 0.5, 1, 0.8, 0],
                }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  delay: i * 0.36,
                  ease: "easeOut",
                  times: [0, 0.2, 0.5, 0.75, 1],
                }}
              />
            );
          })}
        </div>

        {/* 3 pontos dourados pulsantes */}
        <motion.div
          className="flex items-center gap-2 mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="rounded-full"
              style={{ width: 6, height: 6, background: "#C9A84C" }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.75, 1.25, 0.75] }}
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
