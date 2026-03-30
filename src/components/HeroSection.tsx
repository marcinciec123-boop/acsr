import { motion } from "framer-motion";
import { Zap, ChevronRight } from "lucide-react";
import heroImage from "@/assets/hero-arena.jpg";

interface HeroSectionProps {
  onNavigate: (tab: "tournaments") => void;
}

const HeroSection = ({ onNavigate }: HeroSectionProps) => {
  return (
    <section className="relative h-[70vh] min-h-[500px] overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="CS:GO Tournament Arena"
          width={1920}
          height={1080}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
      </div>

      <div className="relative container mx-auto px-4 h-full flex items-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-primary animate-pulse-glow" />
            <span className="text-primary font-mono text-sm tracking-widest uppercase">
              Live Now
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-heading font-bold leading-tight mb-4">
            <span className="text-foreground">BLAST Premier</span>
            <br />
            <span className="text-primary neon-text">Spring Finals</span>
          </h1>

          <p className="text-muted-foreground text-lg mb-8 max-w-lg">
            8 elite teams clash in Copenhagen for the $425,000 prize pool. Watch the best CS:GO action live.
          </p>

          <div className="flex gap-4">
            <button
              onClick={() => onNavigate("tournaments")}
              className="gradient-primary text-primary-foreground font-heading font-semibold px-8 py-3 rounded-md flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              View Tournaments
              <ChevronRight className="w-4 h-4" />
            </button>
            <button className="border border-primary/30 text-primary font-heading font-semibold px-8 py-3 rounded-md hover:bg-primary/10 transition-colors neon-border">
              Live Matches
            </button>
          </div>
        </motion.div>
      </div>

      {/* Decorative elements */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </section>
  );
};

export default HeroSection;
