/**
 * WorkflowDiagram Component
 * 
 * Interactive architecture workflow diagram for PACS onboarding
 * Shows three-column layout: Client Site | Silverback | New Lantern
 * 
 * Features:
 * - Left panel: Configuration checkboxes with conditional text fields
 * - Right panel: Visual three-column architecture diagram
 * - Dynamic arrow rendering based on checkbox selections
 * - Gray labels above arrows describing data flows
 * - Grayed out cards for unchecked/inactive components
 * - Supports 4 workflow types: Orders, Images, Priors, Reports Out
 * 
 * @example
 * <WorkflowDiagram
 *   workflowType="orders"
 *   configuration={savedConfig}
 *   onConfigurationChange={handleChange}
 * />
 */

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Info, ArrowRight } from 'lucide-react';

/**
 * Workflow configuration interface
 * Stores checkbox states, system names, and notes for each workflow path
 */
export interface WorkflowConfiguration {
  // Checkbox states for each data flow path
  paths: {
    [key: string]: boolean; // e.g., "ordersFromRIS": true
  };
  // System names (conditional fields that appear when checkboxes are checked)
  systems: {
    [key: string]: string; // e.g., "risName": "Epic Radiant"
  };
  // Notes for each path
  notes: {
    [key: string]: string; // e.g., "ordersFromRIS_note": "ORM messages for all imaging orders"
  };
}

/**
 * Component props
 */
interface WorkflowDiagramProps {
  workflowType: 'orders' | 'images' | 'priors' | 'reports';
  configuration: WorkflowConfiguration;
  onConfigurationChange: (config: WorkflowConfiguration) => void;
}

/**
 * System card component - represents a system in the architecture diagram
 * Can be active (purple border) or inactive (grayed out)
 */
interface SystemCardProps {
  name: string;
  subtitle?: string;
  isActive: boolean;
  column: 'client' | 'silverback' | 'newlantern';
}

const SystemCard: React.FC<SystemCardProps> = ({ name, subtitle, isActive }) => {
  return (
    <div
      className={`
        rounded-lg border-2 p-3 text-center transition-all
        ${isActive 
          ? 'border-primary bg-card' 
          : 'border-muted bg-muted/30 opacity-40'
        }
      `}
    >
      <div className={`font-semibold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
        {name}
      </div>
      {subtitle && (
        <div className={`text-sm mt-1 ${isActive ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
          {subtitle}
        </div>
      )}
    </div>
  );
};

/**
 * Arrow component - represents data flow between systems
 * Can be single or bidirectional, with label above
 */
interface ArrowProps {
  label: string;
  bidirectional?: boolean;
  isActive: boolean;
}

const Arrow: React.FC<ArrowProps> = ({ label, bidirectional = false, isActive }) => {
  return (
    <div className="flex flex-col items-center justify-center px-2">
      <div className={`text-xs mb-1 text-center ${isActive ? 'text-muted-foreground' : 'text-muted-foreground/40'}`}>
        {label}
      </div>
      <div className="flex items-center">
        {bidirectional && (
          <ArrowRight className={`w-4 h-4 rotate-180 ${isActive ? 'text-primary' : 'text-muted'}`} />
        )}
        <div className={`h-0.5 w-12 ${isActive ? 'bg-primary' : 'bg-muted'}`} />
        <ArrowRight className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted'}`} />
      </div>
    </div>
  );
};

export const WorkflowDiagram: React.FC<WorkflowDiagramProps> = ({
  workflowType,
  configuration,
  onConfigurationChange,
}) => {
  /**
   * Handle checkbox change
   * Updates the paths object in configuration
   */
  const handleCheckboxChange = (pathKey: string, checked: boolean) => {
    onConfigurationChange({
      ...configuration,
      paths: {
        ...configuration.paths,
        [pathKey]: checked,
      },
    });
  };

  /**
   * Handle system name input change
   * Updates the systems object in configuration
   */
  const handleSystemChange = (systemKey: string, value: string) => {
    onConfigurationChange({
      ...configuration,
      systems: {
        ...configuration.systems,
        [systemKey]: value,
      },
    });
  };

  /**
   * Handle note input change
   * Updates the notes object in configuration
   */
  const handleNoteChange = (noteKey: string, value: string) => {
    onConfigurationChange({
      ...configuration,
      notes: {
        ...configuration.notes,
        [noteKey]: value,
      },
    });
  };

  /**
   * Render Orders Workflow
   * Shows: RIS/EHR/Manual Entry → Silverback → New Lantern
   */
  const renderOrdersWorkflow = () => {
    const ordersFromRIS = configuration.paths.ordersFromRIS || false;
    const ordersFromEHR = configuration.paths.ordersFromEHR || false;
    const manualEntry = configuration.paths.manualEntry || false;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Configuration */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Configure Order Sources</h3>
          
          {/* Orders from RIS */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ordersFromRIS"
                checked={ordersFromRIS}
                onCheckedChange={(checked) => handleCheckboxChange('ordersFromRIS', checked as boolean)}
              />
              <Label htmlFor="ordersFromRIS" className="font-medium">
                Orders from RIS (HL7)
              </Label>
            </div>
            {ordersFromRIS && (
              <div className="ml-6 space-y-2">
                <Input
                  placeholder="Which RIS system?"
                  value={configuration.systems.risName || ''}
                  onChange={(e) => handleSystemChange('risName', e.target.value)}
                />
                <Textarea
                  placeholder="Add notes (e.g., ORM messages for all imaging orders)"
                  value={configuration.notes.ordersFromRIS_note || ''}
                  onChange={(e) => handleNoteChange('ordersFromRIS_note', e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Orders from EHR */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ordersFromEHR"
                checked={ordersFromEHR}
                onCheckedChange={(checked) => handleCheckboxChange('ordersFromEHR', checked as boolean)}
              />
              <Label htmlFor="ordersFromEHR" className="font-medium">
                Orders from EHR (HL7)
              </Label>
            </div>
            {ordersFromEHR && (
              <div className="ml-6 space-y-2">
                <Input
                  placeholder="Which EHR system?"
                  value={configuration.systems.ehrName || ''}
                  onChange={(e) => handleSystemChange('ehrName', e.target.value)}
                />
                <Textarea
                  placeholder="Add notes (e.g., eCW will be a new interface)"
                  value={configuration.notes.ordersFromEHR_note || ''}
                  onChange={(e) => handleNoteChange('ordersFromEHR_note', e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Manual Entry */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="manualEntry"
                checked={manualEntry}
                onCheckedChange={(checked) => handleCheckboxChange('manualEntry', checked as boolean)}
              />
              <Label htmlFor="manualEntry" className="font-medium">
                Manual Entry in PACS (No HL7)
              </Label>
            </div>
            {manualEntry && (
              <div className="ml-6">
                <Textarea
                  placeholder="Add notes (e.g., Current state - manual entry today, transitioning to eCW)"
                  value={configuration.notes.manualEntry_note || ''}
                  onChange={(e) => handleNoteChange('manualEntry_note', e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Diagram */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Column Headers */}
              <div className="grid grid-cols-3 gap-4 text-center text-sm font-semibold text-muted-foreground">
                <div>Client Site</div>
                <div>Silverback</div>
                <div>New Lantern</div>
              </div>

              {/* RIS Row */}
              {ordersFromRIS && (
                <div className="grid grid-cols-3 gap-4 items-center">
                  <SystemCard
                    name="RIS"
                    subtitle={configuration.systems.risName}
                    isActive={ordersFromRIS}
                    column="client"
                  />
                  <Arrow label="Orders (HL7)" isActive={ordersFromRIS} />
                  <div /> {/* Empty cell */}
                </div>
              )}

              {/* EHR Row */}
              {ordersFromEHR && (
                <div className="grid grid-cols-3 gap-4 items-center">
                  <SystemCard
                    name="EHR"
                    subtitle={configuration.systems.ehrName}
                    isActive={ordersFromEHR}
                    column="client"
                  />
                  <Arrow label="Orders (HL7)" isActive={ordersFromEHR} />
                  <div /> {/* Empty cell */}
                </div>
              )}

              {/* Silverback → New Lantern (consolidation point) */}
              {(ordersFromRIS || ordersFromEHR) && (
                <div className="grid grid-cols-3 gap-4 items-center">
                  <div /> {/* Empty cell */}
                  <SystemCard
                    name="Silverback"
                    isActive={true}
                    column="silverback"
                  />
                  <Arrow label="Orders" isActive={true} />
                </div>
              )}

              {/* New Lantern */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <div /> {/* Empty cell */}
                <div /> {/* Empty cell */}
                <SystemCard
                  name="New Lantern"
                  subtitle={manualEntry ? "(Manual entry)" : undefined}
                  isActive={true}
                  column="newlantern"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  /**
   * Render Images Workflow
   * Shows: Modalities → AI → PACS → VNA → Silverback → New Lantern
   * OR: Modalities → AI → VNA + Silverback (PACS bypass)
   */
  const renderImagesWorkflow = () => {
    const mwlEnabled = configuration.paths.mwlEnabled || false;
    const aiRouting = configuration.paths.aiRouting || false;
    const routeThroughPACS = configuration.paths.routeThroughPACS || false;
    const directRouting = configuration.paths.directRouting || false;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Configuration */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Configure Image Flow</h3>
          
          {/* Modality Worklist */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mwlEnabled"
                checked={mwlEnabled}
                onCheckedChange={(checked) => handleCheckboxChange('mwlEnabled', checked as boolean)}
              />
              <Label htmlFor="mwlEnabled" className="font-medium">
                Modality Worklist (MWL)
              </Label>
            </div>
            {mwlEnabled && (
              <div className="ml-6 space-y-2">
                <Input
                  placeholder="MWL source (RIS/PACS/Router)"
                  value={configuration.systems.mwlSource || ''}
                  onChange={(e) => handleSystemChange('mwlSource', e.target.value)}
                />
                <Textarea
                  placeholder="Add notes (e.g., RIS sends MWL to modalities - New Lantern does not support MWL)"
                  value={configuration.notes.mwlEnabled_note || ''}
                  onChange={(e) => handleNoteChange('mwlEnabled_note', e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* AI Routing */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="aiRouting"
                checked={aiRouting}
                onCheckedChange={(checked) => handleCheckboxChange('aiRouting', checked as boolean)}
              />
              <Label htmlFor="aiRouting" className="font-medium">
                AI Routing (Conditional)
              </Label>
            </div>
            {aiRouting && (
              <div className="ml-6 space-y-2">
                <Input
                  placeholder="Which AI systems? (e.g., Viz AI, HeartFlow)"
                  value={configuration.systems.aiSystems || ''}
                  onChange={(e) => handleSystemChange('aiSystems', e.target.value)}
                />
                <Textarea
                  placeholder="Add notes (e.g., Viz AI for stroke detection on CT Head studies)"
                  value={configuration.notes.aiRouting_note || ''}
                  onChange={(e) => handleNoteChange('aiRouting_note', e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Route through PACS */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="routeThroughPACS"
                checked={routeThroughPACS}
                onCheckedChange={(checked) => {
                  handleCheckboxChange('routeThroughPACS', checked as boolean);
                  if (checked) handleCheckboxChange('directRouting', false);
                }}
              />
              <Label htmlFor="routeThroughPACS" className="font-medium">
                Route through existing PACS
              </Label>
            </div>
            {routeThroughPACS && (
              <div className="ml-6 space-y-2">
                <Input
                  placeholder="What PACS system?"
                  value={configuration.systems.pacsName || ''}
                  onChange={(e) => handleSystemChange('pacsName', e.target.value)}
                />
                <Input
                  placeholder="What VNA/Archive system?"
                  value={configuration.systems.vnaName || ''}
                  onChange={(e) => handleSystemChange('vnaName', e.target.value)}
                />
                <Textarea
                  placeholder="Add notes (e.g., Images go to PACS first, then VNA)"
                  value={configuration.notes.routeThroughPACS_note || ''}
                  onChange={(e) => handleNoteChange('routeThroughPACS_note', e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Direct routing (PACS bypass) */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="directRouting"
                checked={directRouting}
                onCheckedChange={(checked) => {
                  handleCheckboxChange('directRouting', checked as boolean);
                  if (checked) handleCheckboxChange('routeThroughPACS', false);
                }}
              />
              <Label htmlFor="directRouting" className="font-medium">
                Direct routing to VNA and New Lantern (PACS bypass)
              </Label>
            </div>
            {directRouting && (
              <div className="ml-6 space-y-2">
                <Input
                  placeholder="What VNA/Archive system?"
                  value={configuration.systems.vnaName || ''}
                  onChange={(e) => handleSystemChange('vnaName', e.target.value)}
                />
                <Textarea
                  placeholder="Add notes (e.g., Images route directly to VNA and Silverback, bypassing PACS)"
                  value={configuration.notes.directRouting_note || ''}
                  onChange={(e) => handleNoteChange('directRouting_note', e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Diagram */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Column Headers */}
              <div className="grid grid-cols-3 gap-4 text-center text-sm font-semibold text-muted-foreground">
                <div>Client Site</div>
                <div>Silverback</div>
                <div>New Lantern</div>
              </div>

              {/* MWL Row (if enabled) */}
              {mwlEnabled && (
                <div className="grid grid-cols-3 gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <SystemCard
                      name={configuration.systems.mwlSource || 'MWL Source'}
                      isActive={true}
                      column="client"
                    />
                    <Arrow label="MWL" bidirectional={true} isActive={true} />
                    <SystemCard
                      name="Modalities"
                      isActive={true}
                      column="client"
                    />
                  </div>
                </div>
              )}

              {/* Main Image Flow */}
              <div className="space-y-2">
                {/* Modalities */}
                <div className="grid grid-cols-3 gap-4 items-center">
                  <SystemCard
                    name="Modalities"
                    isActive={true}
                    column="client"
                  />
                  <div />
                  <div />
                </div>

                {/* AI Systems (if enabled) */}
                {aiRouting && (
                  <>
                    <div className="flex justify-start ml-4">
                      <Arrow label="CT Head Studies" isActive={true} />
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <SystemCard
                        name="AI Systems"
                        subtitle={configuration.systems.aiSystems}
                        isActive={true}
                        column="client"
                      />
                      <div />
                      <div />
                    </div>
                  </>
                )}

                {/* PACS (if route through PACS) */}
                {routeThroughPACS && (
                  <>
                    <div className="flex justify-start ml-4">
                      <Arrow label="New Images" isActive={true} />
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <SystemCard
                        name="PACS"
                        subtitle={configuration.systems.pacsName}
                        isActive={true}
                        column="client"
                      />
                      <div />
                      <div />
                    </div>
                    <div className="flex justify-start ml-4">
                      <Arrow label="Archive" isActive={true} />
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <SystemCard
                        name="VNA"
                        subtitle={configuration.systems.vnaName}
                        isActive={true}
                        column="client"
                      />
                      <Arrow label="New Images (DICOM)" isActive={true} />
                      <div />
                    </div>
                  </>
                )}

                {/* Direct routing (PACS grayed out) */}
                {directRouting && (
                  <>
                    <div className="flex justify-start ml-4">
                      <Arrow label="Dual Routing" isActive={true} />
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <SystemCard
                        name="PACS"
                        subtitle="(Bypassed)"
                        isActive={false}
                        column="client"
                      />
                      <div />
                      <div />
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <SystemCard
                        name="VNA"
                        subtitle={configuration.systems.vnaName}
                        isActive={true}
                        column="client"
                      />
                      <Arrow label="New Images (DICOM)" isActive={true} />
                      <div />
                    </div>
                  </>
                )}

                {/* Silverback */}
                <div className="grid grid-cols-3 gap-4 items-center">
                  <div />
                  <SystemCard
                    name="Silverback"
                    isActive={true}
                    column="silverback"
                  />
                  <Arrow label="Images" isActive={true} />
                </div>

                {/* New Lantern */}
                <div className="grid grid-cols-3 gap-4 items-center">
                  <div />
                  <div />
                  <SystemCard
                    name="New Lantern"
                    isActive={true}
                    column="newlantern"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  /**
   * Render Priors Workflow
   * Shows: VNA/EHR/RIS → Silverback → New Lantern
   */
  const renderPriorsWorkflow = () => {
    const priorImagesVNA = configuration.paths.priorImagesVNA || false;
    const priorReportsEHR = configuration.paths.priorReportsEHR || false;
    const priorReportsRIS = configuration.paths.priorReportsRIS || false;
    const priorReportsDICOM = configuration.paths.priorReportsDICOM || false;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Configuration */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Configure Prior Sources</h3>
          
          {/* Prior Images from VNA */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="priorImagesVNA"
                checked={priorImagesVNA}
                onCheckedChange={(checked) => handleCheckboxChange('priorImagesVNA', checked as boolean)}
              />
              <Label htmlFor="priorImagesVNA" className="font-medium">
                Prior Images from VNA (DICOM)
              </Label>
            </div>
            {priorImagesVNA && (
              <div className="ml-6 space-y-2">
                <Textarea
                  placeholder="Add notes (e.g., Query Retrieve enabled for 7-year archive)"
                  value={configuration.notes.priorImagesVNA_note || ''}
                  onChange={(e) => handleNoteChange('priorImagesVNA_note', e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Prior Reports from EHR */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="priorReportsEHR"
                checked={priorReportsEHR}
                onCheckedChange={(checked) => handleCheckboxChange('priorReportsEHR', checked as boolean)}
              />
              <Label htmlFor="priorReportsEHR" className="font-medium">
                Prior Reports from EHR (HL7)
              </Label>
            </div>
            {priorReportsEHR && (
              <div className="ml-6 space-y-2">
                <Textarea
                  placeholder="Add notes (e.g., Epic sends ORU messages with historical reports)"
                  value={configuration.notes.priorReportsEHR_note || ''}
                  onChange={(e) => handleNoteChange('priorReportsEHR_note', e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Prior Reports from RIS */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="priorReportsRIS"
                checked={priorReportsRIS}
                onCheckedChange={(checked) => handleCheckboxChange('priorReportsRIS', checked as boolean)}
              />
              <Label htmlFor="priorReportsRIS" className="font-medium">
                Prior Reports from RIS (HL7)
              </Label>
            </div>
            {priorReportsRIS && (
              <div className="ml-6 space-y-2">
                <Textarea
                  placeholder="Add notes"
                  value={configuration.notes.priorReportsRIS_note || ''}
                  onChange={(e) => handleNoteChange('priorReportsRIS_note', e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Prior Reports in DICOM */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="priorReportsDICOM"
                checked={priorReportsDICOM}
                onCheckedChange={(checked) => handleCheckboxChange('priorReportsDICOM', checked as boolean)}
              />
              <Label htmlFor="priorReportsDICOM" className="font-medium">
                Prior Reports in DICOM (SR/PDF)
              </Label>
            </div>
            {priorReportsDICOM && (
              <div className="ml-6 space-y-2">
                <Textarea
                  placeholder="Add notes (e.g., DICOM SR or PDF encapsulated in DICOM from VNA)"
                  value={configuration.notes.priorReportsDICOM_note || ''}
                  onChange={(e) => handleNoteChange('priorReportsDICOM_note', e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Diagram */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Column Headers */}
              <div className="grid grid-cols-3 gap-4 text-center text-sm font-semibold text-muted-foreground">
                <div>Client Site</div>
                <div>Silverback</div>
                <div>New Lantern</div>
              </div>

              {/* Prior Images from VNA */}
              {priorImagesVNA && (
                <div className="grid grid-cols-3 gap-4 items-center">
                  <SystemCard
                    name="VNA"
                    subtitle="Prior Images"
                    isActive={true}
                    column="client"
                  />
                  <Arrow label="Prior Images (DICOM)" isActive={true} />
                  <div />
                </div>
              )}

              {/* Prior Reports from EHR */}
              {priorReportsEHR && (
                <div className="grid grid-cols-3 gap-4 items-center">
                  <SystemCard
                    name="EHR"
                    subtitle="Prior Reports"
                    isActive={true}
                    column="client"
                  />
                  <Arrow label="Prior Reports (HL7)" isActive={true} />
                  <div />
                </div>
              )}

              {/* Prior Reports from RIS */}
              {priorReportsRIS && (
                <div className="grid grid-cols-3 gap-4 items-center">
                  <SystemCard
                    name="RIS"
                    subtitle="Prior Reports"
                    isActive={true}
                    column="client"
                  />
                  <Arrow label="Prior Reports (HL7)" isActive={true} />
                  <div />
                </div>
              )}

              {/* Prior Reports in DICOM */}
              {priorReportsDICOM && (
                <div className="grid grid-cols-3 gap-4 items-center">
                  <SystemCard
                    name="VNA"
                    subtitle="DICOM SR/PDF"
                    isActive={true}
                    column="client"
                  />
                  <Arrow label="Prior Reports (DICOM)" isActive={true} />
                  <div />
                </div>
              )}

              {/* Silverback → New Lantern */}
              {(priorImagesVNA || priorReportsEHR || priorReportsRIS || priorReportsDICOM) && (
                <>
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div />
                    <SystemCard
                      name="Silverback"
                      isActive={true}
                      column="silverback"
                    />
                    <Arrow label="Priors" isActive={true} />
                  </div>
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div />
                    <div />
                    <SystemCard
                      name="New Lantern"
                      isActive={true}
                      column="newlantern"
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  /**
   * Render Reports Out Workflow
   * Shows: New Lantern → Silverback → EHR/RIS
   */
  const renderReportsOutWorkflow = () => {
    const reportsToEHR = configuration.paths.reportsToEHR || false;
    const reportsToRIS = configuration.paths.reportsToRIS || false;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Configuration */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Configure Report Destinations</h3>
          
          {/* Reports to EHR */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="reportsToEHR"
                checked={reportsToEHR}
                onCheckedChange={(checked) => handleCheckboxChange('reportsToEHR', checked as boolean)}
              />
              <Label htmlFor="reportsToEHR" className="font-medium">
                Send Reports to EHR (HL7 ORU)
              </Label>
            </div>
            {reportsToEHR && (
              <div className="ml-6 space-y-2">
                <Textarea
                  placeholder="Add notes (e.g., ORU messages sent to Epic for all finalized reports)"
                  value={configuration.notes.reportsToEHR_note || ''}
                  onChange={(e) => handleNoteChange('reportsToEHR_note', e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Reports to RIS */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="reportsToRIS"
                checked={reportsToRIS}
                onCheckedChange={(checked) => handleCheckboxChange('reportsToRIS', checked as boolean)}
              />
              <Label htmlFor="reportsToRIS" className="font-medium">
                Send Reports to RIS (HL7 ORU)
              </Label>
            </div>
            {reportsToRIS && (
              <div className="ml-6 space-y-2">
                <Textarea
                  placeholder="Add notes"
                  value={configuration.notes.reportsToRIS_note || ''}
                  onChange={(e) => handleNoteChange('reportsToRIS_note', e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Diagram */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Column Headers */}
              <div className="grid grid-cols-3 gap-4 text-center text-sm font-semibold text-muted-foreground">
                <div>Client Site</div>
                <div>Silverback</div>
                <div>New Lantern</div>
              </div>

              {/* New Lantern → Silverback */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <div />
                <div />
                <SystemCard
                  name="New Lantern"
                  isActive={true}
                  column="newlantern"
                />
              </div>
              <div className="grid grid-cols-3 gap-4 items-center">
                <div />
                <Arrow label="Reports (HL7 ORU)" isActive={true} />
                <SystemCard
                  name="Silverback"
                  isActive={true}
                  column="silverback"
                />
              </div>

              {/* Reports to EHR */}
              {reportsToEHR && (
                <div className="grid grid-cols-3 gap-4 items-center">
                  <Arrow label="Reports" isActive={true} />
                  <SystemCard
                    name="EHR"
                    isActive={true}
                    column="client"
                  />
                  <div />
                </div>
              )}

              {/* Reports to RIS */}
              {reportsToRIS && (
                <div className="grid grid-cols-3 gap-4 items-center">
                  <Arrow label="Reports" isActive={true} />
                  <SystemCard
                    name="RIS"
                    isActive={true}
                    column="client"
                  />
                  <div />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  /**
   * Render the appropriate workflow based on type
   */
  const renderWorkflow = () => {
    switch (workflowType) {
      case 'orders':
        return renderOrdersWorkflow();
      case 'images':
        return renderImagesWorkflow();
      case 'priors':
        return renderPriorsWorkflow();
      case 'reports':
        return renderReportsOutWorkflow();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {renderWorkflow()}
    </div>
  );
};
