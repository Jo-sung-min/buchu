package kr.co.buchu.course;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import static kr.co.buchu.course.CourseModels.*;

@RestController
@RequestMapping("/api")
public class CourseController {
    private final CourseService courses;
    public CourseController(CourseService courses) { this.courses = courses; }

    @GetMapping("/courses")
    public CoursePage list() { return courses.listPublic(); }

    @GetMapping("/courses/{slug}")
    public Course detail(@PathVariable String slug) { return courses.publicCourseBySlug(slug); }

    @GetMapping("/courses/{slug}/lessons/{lessonId}/preview")
    public ResponseEntity<LessonContent> preview(@PathVariable String slug, @PathVariable String lessonId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(courses.preview(slug, lessonId));
    }

    @GetMapping("/admin/courses")
    public ResponseEntity<AdminCoursePage> adminList() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(courses.listAdmin());
    }

    @PostMapping("/admin/courses")
    public ResponseEntity<AdminCourse> create(@RequestBody CourseInput input) {
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).body(courses.create(input));
    }

    @PutMapping("/admin/courses/{id}")
    public ResponseEntity<AdminCourse> update(@PathVariable String id, @RequestBody CourseInput input) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(courses.update(id, input));
    }
}
