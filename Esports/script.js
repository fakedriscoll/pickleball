    // Adicionar interatividade extra
    document.addEventListener('DOMContentLoaded', function() {
      const cards = document.querySelectorAll('.catalog-card');
      
      cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
          this.style.transform = 'perspective(1000px) rotateX(0deg) translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
          this.style.transform = 'perspective(1000px) rotateX(5deg) translateY(0) scale(1)';
        });
      });
    });
  