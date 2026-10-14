package kr.co.buchu.program;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/programs")
public class ProgramController {
    private final ProgramService programs;

    public ProgramController(ProgramService programs) {
        this.programs = programs;
    }

    @GetMapping
    public ProgramResponse list(
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "all") String channel,
            @RequestParam(defaultValue = "all") String cost,
            @RequestParam(defaultValue = "recommended") String sort) {
        return programs.findAll(q, channel, cost, sort);
    }

    @GetMapping("/{slug}")
    public Program detail(@PathVariable String slug) {
        return programs.findBySlug(slug);
    }
}
