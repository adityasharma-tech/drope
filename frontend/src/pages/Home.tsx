import HeroSection from '../components/HeroSection';
import ProductIntroSection from '../components/ProductIntroSection';
import HowItWorksSection from '../components/HowItWorksSection';
import ThermalMapSection from '../components/ThermalMapSection';
import EnvironmentalIntelligenceSection from '../components/EnvironmentalIntelligenceSection';
import PhilosophySection from '../components/PhilosophySection';
import EarlyAccessSection from '../components/EarlyAccessSection';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100vh' }}>
      <HeroSection videoSrc="/hero-video.mp4" posterSrc="/hero-poster.png" />
      <ProductIntroSection />
      <HowItWorksSection />
      <ThermalMapSection />
      <EnvironmentalIntelligenceSection />
      <PhilosophySection />
      <EarlyAccessSection />
      <Footer />
    </div>
  );
}
