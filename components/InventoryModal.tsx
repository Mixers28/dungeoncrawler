'use client';

import { useState } from 'react';
import { type GameState } from '../lib/game-schema';
import { X, Package, Sword, Shield, Scroll, Droplet, Apple, Trash2, CheckCircle2 } from 'lucide-react';

interface InventoryModalProps {
  gameState: GameState;
  isOpen: boolean;
  onClose: () => void;
  onAction: (command: string) => void;
  isProcessing: boolean;
}

type InventoryTab = 'all' | 'weapons' | 'armor' | 'items' | 'quest';

/**
 * InventoryModal Component
 * 
 * Full-screen inventory management interface
 * - View all items
 * - Equip/unequip gear
 * - Use consumables
 * - Drop items
 * - Organized by tabs
 */
export function InventoryModal({
  gameState,
  isOpen,
  onClose,
  onAction,
  isProcessing,
}: InventoryModalProps) {
  const [activeTab, setActiveTab] = useState<InventoryTab>('all');

  if (!isOpen) return null;

  // Filter items by tab
  const getFilteredItems = () => {
    switch (activeTab) {
      case 'weapons':
        return gameState.inventory.filter(i => i.type === 'weapon');
      case 'armor':
        return gameState.inventory.filter(i => i.type === 'armor');
      case 'items':
        return gameState.inventory.filter(i => ['potion', 'scroll', 'food', 'misc'].includes(i.type));
      case 'quest':
        return gameState.inventory.filter(i => i.type === 'key' || i.type === 'material');
      default:
        return gameState.inventory;
    }
  };

  const items = getFilteredItems();

  // Get item icon based on type
  const getItemIcon = (type: string) => {
    switch (type) {
      case 'weapon':
        return <Sword size={18} />;
      case 'armor':
        return <Shield size={18} />;
      case 'potion':
        return <Droplet size={18} />;
      case 'scroll':
        return <Scroll size={18} />;
      case 'food':
        return <Apple size={18} />;
      default:
        return <Package size={18} />;
    }
  };

  // Determine available actions for an item
  const getItemActions = (item: any) => {
    const actions = [];
    if (item.type === 'weapon') {
      if (!item.equipped) {
        actions.push({
          label: 'Equip',
          onClick: () => {
            onAction(`equip ${item.name.toLowerCase()}`);
            onClose();
          },
          color: 'orange',
        });
      } else {
        actions.push({
          label: 'Equipped',
          onClick: () => {},
          color: 'green',
          disabled: true,
        });
      }
    } else if (item.type === 'armor') {
      if (!item.equipped) {
        actions.push({
          label: 'Equip',
          onClick: () => {
            onAction(`equip ${item.name.toLowerCase()}`);
            onClose();
          },
          color: 'blue',
        });
      } else {
        actions.push({
          label: 'Equipped',
          onClick: () => {},
          color: 'green',
          disabled: true,
        });
      }
    } else if (['potion', 'scroll', 'food'].includes(item.type)) {
      actions.push({
        label: 'Use',
        onClick: () => {
          onAction(`use ${item.name.toLowerCase()}`);
          onClose();
        },
        color: 'green',
      });
    }

    // Drop action available for all items
    actions.push({
      label: 'Drop',
      onClick: () => {
        onAction(`drop ${item.name.toLowerCase()}`);
        onClose();
      },
      color: 'red',
      icon: <Trash2 size={14} />,
    });

    return actions;
  };

  const colorMap: Record<string, string> = {
    orange: 'bg-orange-700 hover:bg-orange-600',
    green: 'bg-green-700 hover:bg-green-600',
    blue: 'bg-blue-700 hover:bg-blue-600',
    red: 'bg-red-700 hover:bg-red-600',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-amber-500 flex items-center gap-2">
            <Package size={24} />
            Inventory
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 pt-4 border-b border-slate-700 overflow-x-auto">
          {(['all', 'weapons', 'armor', 'items', 'quest'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-4 font-semibold text-sm whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab
                  ? 'text-amber-400 border-amber-500'
                  : 'text-slate-400 border-transparent hover:text-slate-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="text-center">
                <Package size={48} className="mx-auto mb-3 opacity-50" />
                <p>No items in this category</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => {
                const actions = getItemActions(item);
                return (
                  <div
                    key={item.id}
                    className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3 hover:border-slate-600 transition-colors"
                  >
                    {/* Item Header */}
                    <div className="flex items-start gap-3">
                      <div className="text-slate-400 mt-1">
                        {getItemIcon(item.type)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-100">{item.name}</h3>
                        <p className="text-xs text-slate-500 capitalize">{item.type}</p>
                      </div>
                      {item.equipped && (
                        <div className="text-green-400">
                          <CheckCircle2 size={16} />
                        </div>
                      )}
                    </div>

                    {/* Item Details */}
                    {item.effect && (
                      <div className="text-sm text-slate-400 p-2 bg-slate-900 rounded">
                        {item.effect}
                      </div>
                    )}

                    {/* Quantity */}
                    {item.quantity > 1 && (
                      <div className="text-xs text-slate-400">
                        Quantity: <span className="text-slate-300 font-semibold">{item.quantity}</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 flex-wrap pt-2">
                      {actions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={action.onClick}
                          disabled={isProcessing || action.disabled}
                          className={`flex-1 text-xs font-semibold py-1 px-2 rounded transition-all flex items-center justify-center gap-1 ${
                            colorMap[action.color]
                          } ${action.disabled ? 'opacity-50 cursor-default' : 'text-white disabled:opacity-50 disabled:cursor-not-allowed'}`}
                        >
                          {action.icon}
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-4 bg-slate-800/50 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            <span className="font-semibold">{gameState.inventory.length}</span> items total
          </div>
          <button
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-6 py-2 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
