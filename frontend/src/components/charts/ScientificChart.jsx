import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  ScatterChart,
  LineChart,
  HeatmapChart,
  BoxplotChart,
  CustomChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  AriaComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
echarts.use([
  BarChart,
  ScatterChart,
  LineChart,
  HeatmapChart,
  BoxplotChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  AriaComponent,
  SVGRenderer,
]);
export default function ScientificChart({
  option,
  title,
  description,
  height = 360,
  empty = false,
}) {
  const element = useRef(null);
  useEffect(() => {
    if (empty || !element.current) return;
    const chart = echarts.init(element.current, null, { renderer: "svg" });
    const render = () => {
      const css = getComputedStyle(document.documentElement),
        text = css.getPropertyValue("--text-secondary").trim(),
        border = css.getPropertyValue("--border-subtle").trim();
      const axis = (axis) =>
        Array.isArray(axis) ? axis.map(axisStyle) : axisStyle(axis);
      const axisStyle = (a) =>
        a
          ? {
              nameTextStyle: { color: text, fontSize: 11 },
              axisLabel: { color: text, fontSize: 11, hideOverlap: true },
              axisLine: { lineStyle: { color: border } },
              splitLine: { lineStyle: { color: border, type: "dashed" } },
              ...a,
            }
          : undefined;
      chart.setOption(
        {
          animation: !matchMedia("(prefers-reduced-motion: reduce)").matches,
          animationDuration: 250,
          backgroundColor: "transparent",
          textStyle: { color: text, fontFamily: "inherit" },
          aria: { enabled: true, description: `${title}. ${description}` },
          grid: {
            left: 64,
            right: 24,
            top: 58,
            bottom: 70,
            containLabel: true,
          },
          ...option,
          tooltip: {
            trigger: "item", confine: true, renderMode: "richText",
            ...option.tooltip,
            backgroundColor: css.getPropertyValue("--bg-surface").trim(),
            borderColor: css.getPropertyValue("--border-strong").trim(),
            textStyle: { color: css.getPropertyValue("--text-primary").trim() },
          },
          xAxis: axis(option.xAxis),
          yAxis: axis(option.yAxis),
          legend: option.legend
            ? { ...option.legend, textStyle: { color: text, fontSize: 10 } }
            : undefined,
        },
        true,
      );
    };
    render();
    const resize = new ResizeObserver(() => chart.resize());
    resize.observe(element.current);
    const theme = new MutationObserver(render);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      resize.disconnect();
      theme.disconnect();
      chart.dispose();
    };
  }, [option, title, description, empty]);
  return (
    <figure className="science-figure">
      <figcaption>
        <h3>{title}</h3>
        <p>{description}</p>
      </figcaption>
      {empty ? (
        <div className="science-empty">
          No comparable observations for these filters. Choose another scenario
          or solver.
        </div>
      ) : (
        <div
          ref={element}
          className="science-chart"
          style={{ height }}
          role="img"
          aria-label={`${title}. ${description}. Exact values are available in the observation table below.`}
        />
      )}
    </figure>
  );
}
