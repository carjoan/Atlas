/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { Holiday, VacationGuideData } from './types';
import { GoogleGenAI, Type } from "@google/genai";

// --- ICONS (specific to this view) ---
const IconBack = () => <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z"/></svg>;

// --- SUB-COMPONENTS FOR THE NEW DESIGN ---
const QuickInfoItem = ({ icon, title, value, valueClassName = '' }: { icon: string, title: string, value: string, valueClassName?: string }) => (
    <div className="quick-info-item">
        <span className="quick-info-icon">{icon}</span>
        <div className="quick-info-content">
            <h4>{title}</h4>
            <p className={valueClassName}>{value}</p>
        </div>
    </div>
);

const GuideSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <section className="guide-section">
        <h3>{title}</h3>
        {children}
    </section>
);

const AttractionCard = ({ name, description, type }: { name: string, description: string, type?: string }) => (
    <div className="attraction-card">
        <h5>{name}</h5>
        <p>{description}</p>
        {type && <span className="attraction-type-badge">{type}</span>}
    </div>
);

const FoodCard = ({ name, description }: { name: string, description: string }) => (
    <div className="food-card">
        <h5>{name}</h5>
        <p>{description}</p>
    </div>
);

// --- VIEW COMPONENT ---
export const VacationGuideView = ({ holiday, onBack }: { holiday: Holiday, onBack: () => void }) => {
    const [guideData, setGuideData] = useState<VacationGuideData | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [sources, setSources] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchGuideData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setGuideData(null);
        setSources([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            let prompt = `Generate a comprehensive, visually-oriented vacation guide for a trip to ${holiday.name} between ${holiday.startDate} and ${holiday.endDate}. The traveler is departing from Switzerland. Use Google Search for up-to-date, factual information.

Your response MUST be a single, valid JSON object that can be parsed directly. Do not include any text or markdown formatting outside of the JSON object. The JSON object must conform to the following TypeScript interface:
interface VacationGuideData {
    quickInfo: {
        budget: string; // Estimated budget for a week including flights from Switzerland, e.g., "~$1500-2000 USD for a week, flights ~$500-800".
        dangerLevel: 'low' | 'medium' | 'high'; // Overall safety/danger level.
        language: string; // Primary language spoken.
        currency: string; // Local currency with symbol, e.g., 'Euro (€)'.
        bestTime: string; // Best time to visit, e.g., 'Jan-Feb, Dez-Mar'.
        visa: string; // Brief visa requirements, e.g., '90 days visa-free'.
        weather: string; // Expected weather for the selected travel dates, e.g., 'Sunny, avg. 25°C'.
    };
    attractions: {
        landmarks: { name: string; description: string; }[];
        seasonalEvents: { name: string; description: string; }[]; // Events happening during the specified travel dates.
        options: { name: string; description: string; type: 'Adventure' | 'Relaxation' | 'Cultural'; }[];
    };
    food: {
        signatureDishes: { name: string; description: string; }[];
        streetFoodSafety: string; // Tips on street food safety.
        restaurantPrices: string; // Average restaurant prices, e.g., 'Budget: $5-10, Mid-range: $15-30, Fine Dining: $50+'.
    };
    packing: {
        clothing: string[];
        gear: string[];
        specialItems: string[];
    };
    tailoredSuggestions?: string; // Personalized suggestions based on the user's trip description. This field can be omitted if no description was provided.
}`;

            if (holiday.description) {
                prompt += ` \n\nThe user has provided this description for their trip: "${holiday.description}". Use this to generate personalized suggestions in the 'tailoredSuggestions' field. This section should directly address the user's notes and suggest specific activities or approaches that align with their stated interests.`;
            } else {
                prompt += ` \n\nThe user did not provide a description. The 'tailoredSuggestions' field can be omitted or be an empty string.`;
            }
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                }
            });

            // The response text from a model using tools might not be pure JSON.
            // It's a good practice to clean it up before parsing.
            let jsonText = response.text.trim();
            const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch && jsonMatch[1]) {
                jsonText = jsonMatch[1];
            }

            const parsedData = JSON.parse(jsonText) as VacationGuideData;
            setGuideData(parsedData);

            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks) {
                const uniqueSources = groundingChunks
                    .map((chunk: any) => chunk.web)
                    .filter((web: any) => web && web.uri)
                    .reduce((acc: any[], current: any) => {
                        if (!acc.find((item) => item.uri === current.uri)) {
                            acc.push(current);
                        }
                        return acc;
                    }, []);
                setSources(uniqueSources);
            }

        } catch (e: any) {
            console.error("Failed to fetch or parse vacation guide:", e);
            setError(`Sorry, the AI couldn't generate a guide for this destination. It might be an unsupported location or there was a network issue. Please try again.\n\nDetails: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [holiday]);

    useEffect(() => {
        fetchGuideData();
        
        const fetchImage = async () => {
            setImageUrl(null);
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const response = await ai.models.generateImages({
                    model: 'imagen-3.0-generate-002',
                    prompt: `A beautiful, high-quality, photorealistic travel poster for a vacation in ${holiday.name}. Clean, simple, beautiful landscape. No text on the image. 16:9 aspect ratio, cinematic.`,
                    config: {
                        numberOfImages: 1,
                        outputMimeType: 'image/jpeg',
                        aspectRatio: '16:9',
                    },
                });
                const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
                const url = `data:image/jpeg;base64,${base64ImageBytes}`;
                setImageUrl(url);
            } catch (e) {
                console.error("Failed to generate header image:", e);
            }
        };
        fetchImage();
    }, [fetchGuideData, holiday.name]);


    if (isLoading) {
        return (
            <div className="vacation-guide-view loading">
                <div className="loading-spinner large"></div>
                <p>🛰️ Contacting travel satellites...</p>
                <p className="loading-subtext">AI is crafting your personalized guide for {holiday.name}.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="vacation-guide-view error">
                 <button onClick={onBack} className="back-button"><IconBack /> Back to Planner</button>
                 <div className="error-content">
                    <h3>Oops! Something went wrong.</h3>
                    <p>{error}</p>
                    <button onClick={fetchGuideData} className="add-holiday-btn">Try Again</button>
                </div>
            </div>
        );
    }

    if (!guideData) {
        return (
            <div className="vacation-guide-view">
                 <button onClick={onBack} className="back-button"><IconBack /> Back to Planner</button>
                 <p>No guide data available.</p>
            </div>
        );
    }
    
    const { quickInfo, attractions, food, packing, tailoredSuggestions } = guideData;
    const dangerLevelClass = `danger-${quickInfo.dangerLevel}`;

    return (
        <div className="vacation-guide-view">
            <header className="guide-header" style={{
                backgroundImage: imageUrl 
                    ? `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.8)), url(${imageUrl})` 
                    : `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.8)), linear-gradient(to right, ${holiday.color}, var(--primary-variant-color))`
            } as React.CSSProperties}>
                <div className="guide-header-content">
                    <button onClick={onBack} className="back-button"><IconBack /> Back</button>
                    <h1>{holiday.name}</h1>
                    <p className="guide-dates">{new Date(holiday.startDate).toLocaleDateString(undefined, {month: 'long', day: 'numeric'})} - {new Date(holiday.endDate).toLocaleDateString(undefined, {month: 'long', day: 'numeric', year: 'numeric'})}</p>
                </div>
            </header>
            
            <main>
                <div className="quick-info-grid">
                    <QuickInfoItem icon="💰" title="Est. Budget" value={quickInfo.budget} />
                    <QuickInfoItem icon="🛡️" title="Danger Level" value={quickInfo.dangerLevel} valueClassName={dangerLevelClass} />
                    <QuickInfoItem icon="🗣️" title="Language" value={quickInfo.language} />
                    <QuickInfoItem icon="💵" title="Currency" value={quickInfo.currency} />
                    <QuickInfoItem icon="🗓️" title="Best Time" value={quickInfo.bestTime} />
                    <QuickInfoItem icon="🛂" title="Visa" value={quickInfo.visa} />
                    <QuickInfoItem icon="🌦️" title="Weather" value={quickInfo.weather} />
                </div>
                
                <div className="guide-content-grid">
                    <GuideSection title="Top Attractions & Activities">
                        <h4>Must-See Landmarks</h4>
                        <div className="attractions-grid">
                            {attractions.landmarks.map(item => <AttractionCard key={item.name} {...item} />)}
                        </div>

                        <h4>Seasonal Events</h4>
                         {attractions.seasonalEvents.length > 0 ? (
                            <div className="attractions-grid">
                                {attractions.seasonalEvents.map(item => <AttractionCard key={item.name} {...item} />)}
                            </div>
                        ) : <p>No specific seasonal events found for your dates.</p>}


                        <h4>Adventure / Relaxation / Cultural Options</h4>
                        <div className="attractions-grid">
                            {attractions.options.map(item => <AttractionCard key={item.name} {...item} />)}
                        </div>
                    </GuideSection>
                    
                     <GuideSection title="Food & Drink Highlights">
                        <h4>Signature Dishes</h4>
                        <div className="food-grid">
                            {food.signatureDishes.map(item => <FoodCard key={item.name} {...item} />)}
                        </div>
                        <div className="food-details">
                            <p><strong>Street Food Safety:</strong> {food.streetFoodSafety}</p>
                            <p><strong>Avg. Restaurant Prices:</strong> {food.restaurantPrices}</p>
                        </div>
                    </GuideSection>

                    <GuideSection title="Packing Essentials">
                        <div className="packing-grid">
                            <div>
                                <h4>Clothing</h4>
                                <ul className="packing-list">
                                    {packing.clothing.map(item => <li key={item}>{item}</li>)}
                                </ul>
                            </div>
                            <div>
                                <h4>Travel Gear</h4>
                                <ul className="packing-list">
                                    {packing.gear.map(item => <li key={item}>{item}</li>)}
                                </ul>
                            </div>
                            <div>
                                <h4>Special Items</h4>
                                <ul className="packing-list">
                                    {packing.specialItems.map(item => <li key={item}>{item}</li>)}
                                </ul>
                            </div>
                        </div>
                    </GuideSection>

                    {tailoredSuggestions && (
                        <GuideSection title="For Your Trip...">
                            <div className="tailored-suggestions-section">
                                <p>{tailoredSuggestions}</p>
                            </div>
                        </GuideSection>
                    )}
                    
                    {sources.length > 0 && (
                        <section className="guide-section sources-section">
                            <h3>Sources</h3>
                            <ul className="sources-list">
                                {sources.map(source => (
                                    <li key={source.uri}>
                                        <a href={source.uri} target="_blank" rel="noopener noreferrer">
                                            {source.title || source.uri}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            </main>
        </div>
    );
};