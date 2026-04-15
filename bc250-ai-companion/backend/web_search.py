"""
Módulo de Búsqueda Web para BC-250 AI Companion
Búsqueda bajo demanda explícita usando DuckDuckGo/SearXNG
"""
import requests
from typing import List, Dict, Optional
from urllib.parse import quote_plus


class WebSearch:
    def __init__(self):
        # Usar DuckDuckGo HTML scraping (sin API key necesaria)
        self.search_url = "https://html.duckduckgo.com/html/"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    
    def search(self, query: str, num_results: int = 5) -> List[Dict]:
        """
        Realiza búsqueda web
        Returns: lista de resultados con título, snippet y URL
        """
        results = []
        
        try:
            # Preparar query
            data = {"q": query}
            
            response = requests.post(
                self.search_url,
                data=data,
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                results = self._parse_results(response.text, num_results)
            
        except Exception as e:
            print(f"Error en búsqueda web: {e}")
        
        return results
    
    def _parse_results(self, html: str, num_results: int) -> List[Dict]:
        """Parsea resultados HTML de DuckDuckGo"""
        results = []
        
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            
            # Encontrar resultados
            result_divs = soup.find_all('div', class_='result', limit=num_results)
            
            for div in result_divs:
                title_elem = div.find('a', class_='result__a')
                snippet_elem = div.find('a', class_='result__snippet')
                
                if title_elem and snippet_elem:
                    title = title_elem.get_text(strip=True)
                    snippet = snippet_elem.get_text(strip=True)
                    url = title_elem.get('href')
                    
                    # DuckDuckGo usa redirect, limpiar URL si es necesario
                    if url and url.startswith('http'):
                        results.append({
                            "title": title,
                            "snippet": snippet,
                            "url": url
                        })
        
        except ImportError:
            print("BeautifulSoup no disponible, usando parseo básico")
            # Parseo básico sin BeautifulSoup
            lines = html.split('\n')
            for line in lines:
                if 'class="result__a"' in line and len(results) < num_results:
                    # Extraer título y URL básico
                    start = line.find('">') + 2
                    end = line.find('</a>', start)
                    if start > 1 and end > start:
                        title = line[start:end].strip()
                        results.append({
                            "title": title[:100],  # Limitar longitud
                            "snippet": "",
                            "url": ""
                        })
        
        except Exception as e:
            print(f"Error parseando resultados: {e}")
        
        return results
    
    def search_and_format(self, query: str, num_results: int = 3) -> str:
        """
        Realiza búsqueda y devuelve formato legible para el LLM
        """
        results = self.search(query, num_results)
        
        if not results:
            return "No se encontraron resultados en internet."
        
        formatted = "Resultados de búsqueda:\n\n"
        for i, result in enumerate(results, 1):
            formatted += f"{i}. **{result['title']}**\n"
            if result['snippet']:
                formatted += f"   {result['snippet']}\n"
            if result['url']:
                formatted += f"   URL: {result['url']}\n"
            formatted += "\n"
        
        return formatted
    
    def is_available(self) -> bool:
        """Verifica si hay conexión a internet"""
        try:
            response = requests.get("https://duckduckgo.com", timeout=5)
            return response.status_code == 200
        except:
            return False
